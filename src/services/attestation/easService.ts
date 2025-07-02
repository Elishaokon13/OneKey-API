// OneKey KYC API - EAS Service Implementation
// Ethereum Attestation Service integration for KYC verification proofs

import { ethers } from 'ethers';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { BaseAttestationService } from './baseAttestationService';
import {
  EasAttestation,
  CreateAttestationRequest,
  AttestationVerificationResult,
  AttestationError,
  AttestationCreationError,
  AttestationVerificationError,
  AttestationNotFoundError,
  BlockchainError,
  GasEstimate,
  EasConfig,
  AttestationData,
  AttestationStatus
} from '../../types/attestation';
import { config } from '../../config/environment';
import { logger } from '../../utils/logger';

export class EasService extends BaseAttestationService {
  private eas!: EAS;
  private schemaEncoder!: SchemaEncoder;
  private readonly SCHEMA_DEFINITION = 
    'string kycProvider,string kycSessionId,string verificationStatus,uint256 verificationTimestamp,uint256 confidenceScore,string userIdHash,string countryCode,string documentType,bool documentVerified,bool biometricVerified,bool livenessVerified,bool addressVerified,bool sanctionsCleared,bool pepCleared,string riskLevel,uint256 riskScore,string schemaVersion,string apiVersion,string attestationStandard';

  constructor(easConfig: EasConfig) {
    super(easConfig);
  }

  // ===== Provider Initialization =====

  protected async initializeProvider(): Promise<void> {
    try {
      logger.info('Initializing EAS provider', {
        chainId: this.config.chainId,
        rpcUrl: this.config.rpcUrl,
        contractAddress: this.config.contractAddress
      });

      // Initialize ethers provider
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      
      // Initialize signer
      this.signer = new ethers.Wallet(this.config.attesterPrivateKey, this.provider);
      
      // Verify signer address matches config
      const signerAddress = await this.signer.getAddress();
      if (signerAddress.toLowerCase() !== this.config.attesterAddress.toLowerCase()) {
        throw new Error(`Signer address mismatch: expected ${this.config.attesterAddress}, got ${signerAddress}`);
      }

      // Initialize EAS SDK
      this.eas = new EAS(this.config.contractAddress);
      this.eas.connect(this.signer);

      // Initialize schema encoder
      this.schemaEncoder = new SchemaEncoder(this.SCHEMA_DEFINITION);

      // Verify network connection
      const network = await this.provider.getNetwork();
      if (Number(network.chainId) !== this.config.chainId) {
        throw new Error(`Chain ID mismatch: expected ${this.config.chainId}, got ${network.chainId}`);
      }

      logger.info('EAS provider initialized successfully', {
        chainId: Number(network.chainId),
        attesterAddress: signerAddress,
        blockNumber: await this.provider.getBlockNumber()
      });

    } catch (error) {
      logger.error('Failed to initialize EAS provider', { error });
      throw new BlockchainError(
        'EAS provider initialization failed',
        this.config.chainId,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Attestation Creation =====

  protected async createAttestation(request: CreateAttestationRequest): Promise<EasAttestation> {
    try {
      // Transform KYC result to attestation data
      const attestationData = this.transformKycToAttestationData(
        request.kycResult,
        request.recipient
      );

      // Encode the attestation data
      const encodedData = this.encodeAttestationData(attestationData);
      
      // Prepare attestation request
      const attestationRequest = {
        schema: this.config.defaultSchemaId,
        data: {
          recipient: request.recipient,
          expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
          revocable: request.options?.revocable ?? true,
          data: encodedData,
        },
      };

      logger.info('Creating EAS attestation', {
        recipient: request.recipient,
        schema: this.config.defaultSchemaId,
        expirationTime: attestationRequest.data.expirationTime.toString(),
        revocable: attestationRequest.data.revocable
      });

      // Create the attestation on-chain
      const tx = await this.eas.attest(attestationRequest);
      const txHash = await tx.wait();

      if (!txHash) {
        throw new AttestationCreationError('Transaction hash not available');
      }

      // Get the actual receipt from provider
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new AttestationCreationError('Transaction receipt not available');
      }

      // Extract attestation UID from transaction logs
      const uid = await this.extractAttestationUid(receipt);

      // Get block information
      const block = await this.provider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new BlockchainError('Block not found', this.config.chainId, receipt.blockNumber);
      }

      // Create attestation object
      const attestation: EasAttestation = {
        id: uuidv4(),
        uid,
        schemaId: this.config.defaultSchemaId,
        attester: this.config.attesterAddress,
        recipient: request.recipient,
        data: attestationData,
        encodedData,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockTimestamp: block.timestamp,
        chainId: this.config.chainId,
        status: 'confirmed' as AttestationStatus,
        revoked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Number(attestationRequest.data.expirationTime) * 1000).toISOString(),
        metadata: {
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: receipt.gasPrice?.toString(),
          requestId: request.requestId,
          ...request.options?.onChainMetadata
        }
      };

      // Log successful creation
      this.logAttestationActivity('created', uid, this.config.attesterAddress, {
        kycProvider: attestationData.kycProvider,
        confidenceScore: attestationData.confidenceScore,
        gasUsed: receipt.gasUsed.toString()
      });

      // Store attestation in database (placeholder - would be implemented)
      await this.storeAttestation(attestation);

      return attestation;

    } catch (error) {
      logger.error('Failed to create EAS attestation', {
        recipient: request.recipient,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AttestationError) {
        throw error;
      }

      throw new AttestationCreationError(
        'EAS attestation creation failed',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Attestation Verification =====

  protected async verifyOnChain(uid: string): Promise<AttestationVerificationResult> {
    try {
      logger.info('Verifying attestation on-chain', { uid });

      const startTime = Date.now();

      // Get attestation from EAS
      const attestation = await this.eas.getAttestation(uid);

      if (!attestation) {
        throw new AttestationNotFoundError(uid);
      }

      // Verify attestation properties
      const verification = {
        onChain: true,
        schemaValid: attestation.schema === this.config.defaultSchemaId,
        notRevoked: !attestation.revocationTime || attestation.revocationTime === 0n,
        notExpired: attestation.expirationTime === 0n || attestation.expirationTime > BigInt(Math.floor(Date.now() / 1000)),
        attesterValid: attestation.attester.toLowerCase() === this.config.attesterAddress.toLowerCase(),
        recipientMatch: true // Will be validated by caller if needed
      };

      const valid = Object.values(verification).every(v => v === true);

      // Get current block for timestamp
      const currentBlock = await this.provider.getBlockNumber();

      const result: AttestationVerificationResult = {
        valid,
        verification,
        details: {
          checkedAt: new Date().toISOString(),
          blockNumber: currentBlock,
          verificationTime: Date.now() - startTime
        },
        ...(valid ? {} : { errors: this.getVerificationErrors(verification) })
      };

      // If verification passed, include full attestation data
      if (valid) {
        result.attestation = await this.parseOnChainAttestation(attestation, uid);
      }

      logger.info('Attestation verification completed', {
        uid,
        valid,
        verificationTime: result.details.verificationTime
      });

      return result;

    } catch (error) {
      logger.error('Failed to verify attestation', {
        uid,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AttestationError) {
        throw error;
      }

      throw new AttestationVerificationError(
        'Attestation verification failed',
        uid,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Gas Estimation =====

  protected async estimateGas(request: CreateAttestationRequest): Promise<GasEstimate> {
    try {
      const attestationData = this.transformKycToAttestationData(
        request.kycResult,
        request.recipient
      );

      const encodedData = this.encodeAttestationData(attestationData);

      const attestationRequest = {
        schema: this.config.defaultSchemaId,
        data: {
          recipient: request.recipient,
          expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
          revocable: request.options?.revocable ?? true,
          data: encodedData,
        },
      };

      // Estimate gas for the transaction (using reasonable default since EAS SDK doesn't expose estimateGas)
      const estimatedGas = BigInt(350000); // Typical gas for EAS attestation
      
      // Get current gas price
      let gasPrice: bigint;
      if (this.config.gasPrice) {
        gasPrice = ethers.parseUnits(this.config.gasPrice, 'gwei');
      } else {
        gasPrice = (await this.provider.getFeeData()).gasPrice || ethers.parseUnits('20', 'gwei');
      }

      const gasLimit = Number(estimatedGas) + 50000; // Add buffer
      const totalCost = gasPrice * BigInt(gasLimit);

      return {
        gasLimit,
        gasPrice: ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
        totalCost: ethers.formatEther(totalCost) + ' ETH',
        estimatedConfirmationTime: this.estimateConfirmationTime(gasPrice)
      };

    } catch (error) {
      logger.error('Gas estimation failed', {
        recipient: request.recipient,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new AttestationError(
        'Gas estimation failed',
        'GAS_ESTIMATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Revocation =====

  public async revokeAttestation(uid: string, reason?: string): Promise<boolean> {
    try {
      if (!this.config.enableRevocation) {
        throw new AttestationError(
          'Attestation revocation is disabled',
          'REVOCATION_DISABLED'
        );
      }

      logger.info('Revoking attestation', { uid, reason });

      const tx = await this.eas.revoke({
        schema: this.config.defaultSchemaId,
        data: { uid, value: 0n }
      });

      await tx.wait();
      const txHash = tx.hash;

      // Get the actual receipt from provider
      const receipt = await this.provider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new AttestationError('Revocation receipt not available', 'REVOCATION_FAILED');
      }

      // Log revocation activity
      this.logAttestationActivity('revoked', uid, this.config.attesterAddress, {
        reason,
        transactionHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      });

      // Update attestation in database (placeholder)
      await this.updateAttestationStatus(uid, 'revoked', reason);

      logger.info('Attestation revoked successfully', {
        uid,
        transactionHash: receipt.hash
      });

      return true;

    } catch (error) {
      logger.error('Failed to revoke attestation', {
        uid,
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof AttestationError) {
        throw error;
      }

      throw new AttestationError(
        'Attestation revocation failed',
        'REVOCATION_FAILED',
        { uid, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Helper Methods =====

  private encodeAttestationData(data: AttestationData): string {
    return this.schemaEncoder.encodeData([
      { name: 'kycProvider', value: data.kycProvider, type: 'string' },
      { name: 'kycSessionId', value: data.kycSessionId, type: 'string' },
      { name: 'verificationStatus', value: data.verificationStatus, type: 'string' },
      { name: 'verificationTimestamp', value: data.verificationTimestamp, type: 'uint256' },
      { name: 'confidenceScore', value: data.confidenceScore, type: 'uint256' },
      { name: 'userIdHash', value: data.userIdHash, type: 'string' },
      { name: 'countryCode', value: data.countryCode || '', type: 'string' },
      { name: 'documentType', value: data.documentType || '', type: 'string' },
      { name: 'documentVerified', value: data.documentVerified, type: 'bool' },
      { name: 'biometricVerified', value: data.biometricVerified, type: 'bool' },
      { name: 'livenessVerified', value: data.livenessVerified, type: 'bool' },
      { name: 'addressVerified', value: data.addressVerified, type: 'bool' },
      { name: 'sanctionsCleared', value: data.sanctionsCleared, type: 'bool' },
      { name: 'pepCleared', value: data.pepCleared, type: 'bool' },
      { name: 'riskLevel', value: data.riskLevel, type: 'string' },
      { name: 'riskScore', value: data.riskScore, type: 'uint256' },
      { name: 'schemaVersion', value: data.schemaVersion, type: 'string' },
      { name: 'apiVersion', value: data.apiVersion, type: 'string' },
      { name: 'attestationStandard', value: data.attestationStandard, type: 'string' }
    ]);
  }

  private async extractAttestationUid(receipt: ethers.TransactionReceipt): Promise<string> {
    // Parse transaction logs to find the Attested event
    for (const log of receipt.logs) {
      try {
        const iface = new ethers.Interface([
          'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 schema)'
        ]);
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'Attested') {
          return parsed.args.uid;
        }
      } catch {
        // Ignore parsing errors for other events
      }
    }
    throw new AttestationCreationError('Could not extract attestation UID from transaction');
  }

  private async parseOnChainAttestation(onChainAttestation: any, uid: string): Promise<EasAttestation> {
    // This would decode the on-chain attestation data back to our format
    // For now, return a placeholder implementation
    const decoded = this.schemaEncoder.decodeData(onChainAttestation.data);
    
    const attestationData: AttestationData = {
      kycProvider: decoded.find(d => d.name === 'kycProvider')?.value.value as any,
      kycSessionId: decoded.find(d => d.name === 'kycSessionId')?.value.value as string,
      verificationStatus: decoded.find(d => d.name === 'verificationStatus')?.value.value as any,
      verificationTimestamp: Number(decoded.find(d => d.name === 'verificationTimestamp')?.value.value),
      confidenceScore: Number(decoded.find(d => d.name === 'confidenceScore')?.value.value),
      userIdHash: decoded.find(d => d.name === 'userIdHash')?.value.value as string,
      countryCode: decoded.find(d => d.name === 'countryCode')?.value.value as string,
      documentType: decoded.find(d => d.name === 'documentType')?.value.value as string,
      documentVerified: decoded.find(d => d.name === 'documentVerified')?.value.value as boolean,
      biometricVerified: decoded.find(d => d.name === 'biometricVerified')?.value.value as boolean,
      livenessVerified: decoded.find(d => d.name === 'livenessVerified')?.value.value as boolean,
      addressVerified: decoded.find(d => d.name === 'addressVerified')?.value.value as boolean,
      sanctionsCleared: decoded.find(d => d.name === 'sanctionsCleared')?.value.value as boolean,
      pepCleared: decoded.find(d => d.name === 'pepCleared')?.value.value as boolean,
      riskLevel: decoded.find(d => d.name === 'riskLevel')?.value.value as any,
      riskScore: Number(decoded.find(d => d.name === 'riskScore')?.value.value),
      schemaVersion: decoded.find(d => d.name === 'schemaVersion')?.value.value as string,
      apiVersion: decoded.find(d => d.name === 'apiVersion')?.value.value as string,
      attestationStandard: decoded.find(d => d.name === 'attestationStandard')?.value.value as string
    };

    return {
      id: uuidv4(), // Would be from database
      uid,
      schemaId: onChainAttestation.schema,
      attester: onChainAttestation.attester,
      recipient: onChainAttestation.recipient,
      data: attestationData,
      encodedData: onChainAttestation.data,
      transactionHash: '', // Would need to query
      blockNumber: 0, // Would need to query
      blockTimestamp: Number(onChainAttestation.time),
      chainId: this.config.chainId,
      status: onChainAttestation.revocationTime > 0 ? 'revoked' : 'confirmed',
      revoked: onChainAttestation.revocationTime > 0,
      ...(onChainAttestation.revocationTime > 0 && { revokedAt: Number(onChainAttestation.revocationTime) }),
      createdAt: new Date(Number(onChainAttestation.time) * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      ...(onChainAttestation.expirationTime > 0 && { 
        expiresAt: new Date(Number(onChainAttestation.expirationTime) * 1000).toISOString() 
      }),
      metadata: {}
    };
  }

  private getVerificationErrors(verification: any): string[] {
    const errors: string[] = [];
    
    if (!verification.onChain) errors.push('Attestation not found on-chain');
    if (!verification.schemaValid) errors.push('Invalid schema');
    if (!verification.notRevoked) errors.push('Attestation has been revoked');
    if (!verification.notExpired) errors.push('Attestation has expired');
    if (!verification.attesterValid) errors.push('Invalid attester');
    if (!verification.recipientMatch) errors.push('Recipient mismatch');
    
    return errors;
  }

  private estimateConfirmationTime(gasPrice: bigint): number {
    // Rough estimation based on gas price
    const gasPriceGwei = Number(ethers.formatUnits(gasPrice, 'gwei'));
    
    if (gasPriceGwei > 50) return 30; // Fast
    if (gasPriceGwei > 20) return 60; // Standard
    return 180; // Slow
  }

  // ===== Database Operations (Placeholder) =====

  private async storeAttestation(attestation: EasAttestation): Promise<void> {
    // TODO: Implement database storage
    logger.info('Storing attestation in database', { uid: attestation.uid });
  }

  private async updateAttestationStatus(uid: string, status: AttestationStatus, reason?: string): Promise<void> {
    // TODO: Implement database update
    logger.info('Updating attestation status', { uid, status, reason });
  }
} 
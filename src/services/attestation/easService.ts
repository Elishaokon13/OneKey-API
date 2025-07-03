// OneKey KYC API - EAS Service Implementation
// Ethereum Attestation Service integration for KYC verification proofs

import { ethers } from 'ethers';
import { EAS, SchemaEncoder, MultiAttestationRequest, AttestationRequestData } from '@ethereum-attestation-service/eas-sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { BaseAttestationService } from './baseAttestationService';
import { SchemaManager } from './schemaManager';
import { ArweaveService } from '../storage/arweaveService';
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
  AttestationStatus,
  SchemaConfig
} from '../../types/attestation';
import { config } from '../../config/environment';
import { logger } from '../../utils/logger';

interface RequestMetadata {
  requestId: string;
  originalData: AttestationData;
}

interface ExtendedMultiAttestationRequest extends MultiAttestationRequest {
  _requestMetadata: RequestMetadata;
}

export class EasService extends BaseAttestationService {
  private eas!: EAS;
  private schemaEncoder!: SchemaEncoder;
  private schemaManager!: SchemaManager;
  private arweaveService?: ArweaveService;
  private readonly SCHEMA_DEFINITION = 
    'string kycProvider,string kycSessionId,string verificationStatus,uint256 verificationTimestamp,uint256 confidenceScore,string userIdHash,string countryCode,string documentType,bool documentVerified,bool biometricVerified,bool livenessVerified,bool addressVerified,bool sanctionsCleared,bool pepCleared,string riskLevel,uint256 riskScore,string schemaVersion,string apiVersion,string attestationStandard';

  constructor(
    easConfig: EasConfig,
    private readonly arweaveConfig?: any // TODO: Add proper type
  ) {
    super(easConfig);
    if (arweaveConfig) {
      this.arweaveService = new ArweaveService(arweaveConfig);
    }
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

      // Initialize schema manager
      const schemaConfig: SchemaConfig = {
        rpcUrl: this.config.rpcUrl,
        registryAddress: this.config.schemaRegistryAddress,
        privateKey: this.config.attesterPrivateKey,
        defaultResolver: this.config.contractAddress,
        caching: {
          enabled: true,
          ttl: 3600 // 1 hour
        }
      };
      
      this.schemaManager = new SchemaManager(schemaConfig);
      await this.schemaManager.initialize();

      // Verify schema exists and is valid
      await this.validateDefaultSchema();

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

  // ===== Schema Management =====

  private async validateDefaultSchema(): Promise<void> {
    try {
      const validation = await this.schemaManager.validateSchema(this.config.defaultSchemaId);
      
      if (!validation.valid) {
        throw new AttestationError(
          'Default schema validation failed',
          'SCHEMA_VALIDATION_FAILED',
          {
            schemaId: this.config.defaultSchemaId,
            errors: validation.errors,
            warnings: validation.warnings
          }
        );
      }

      logger.info('Default schema validated successfully', {
        schemaId: this.config.defaultSchemaId,
        version: validation.version
      });
    } catch (error) {
      logger.error('Schema validation failed', { error });
      throw new AttestationError(
        'Schema validation failed',
        'SCHEMA_VALIDATION_FAILED',
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

      // Create the attestation with retry mechanism
      const { transaction: tx, receipt } = await this.executeWithRetry(
        () => this.eas.attest(attestationRequest),
        'Attestation creation'
      );

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

      // Store attestation in database
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

  // ===== Batch Attestation =====

  async createBatchAttestations(
    requests: CreateAttestationRequest[]
  ): Promise<EasAttestation[]> {
    try {
      // Validate all requests first
      await Promise.all(requests.map(request => this.validateRequest(request)));

      // Prepare all attestation requests
      const attestationRequests: ExtendedMultiAttestationRequest[] = await Promise.all(
        requests.map(async request => {
          const attestationData = this.transformKycToAttestationData(
            request.kycResult,
            request.recipient
          );
          const encodedData = this.encodeAttestationData(attestationData);

          const requestData: AttestationRequestData = {
            recipient: request.recipient,
            expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
            revocable: request.options?.revocable ?? true,
            data: encodedData,
          };

          return {
            schema: this.config.defaultSchemaId,
            data: [requestData],
            _requestMetadata: {
              requestId: request.requestId || crypto.randomUUID(),
              originalData: attestationData
            }
          };
        })
      );

      // Create attestations in batches of 10
      const batchSize = 10;
      const attestations: EasAttestation[] = [];

      for (let i = 0; i < attestationRequests.length; i += batchSize) {
        const batch = attestationRequests.slice(i, i + batchSize);
        
        // Create batch with retry
        const { transaction: tx, receipt } = await this.executeWithRetry(
          () => this.eas.multiAttest(batch),
          `Batch attestation ${i / batchSize + 1}`
        );

        // Process batch results
        const batchAttestations = await this.processBatchReceipt(
          receipt,
          batch
        );

        attestations.push(...batchAttestations);
      }

      // Store attestations
      await Promise.all(attestations.map(attestation => this.storeAttestation(attestation)));

      return attestations;

    } catch (error) {
      logger.error('Batch attestation creation failed', { error });
      throw new AttestationCreationError(
        'Batch attestation creation failed',
        undefined,
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async processBatchReceipt(
    receipt: ethers.TransactionReceipt,
    requests: ExtendedMultiAttestationRequest[]
  ): Promise<EasAttestation[]> {
    const attestations: EasAttestation[] = [];
    const block = await this.provider.getBlock(receipt.blockNumber);

    if (!block) {
      throw new BlockchainError('Block not found', this.config.chainId, receipt.blockNumber);
    }

    // Extract UIDs from logs
    const uids = this.extractBatchAttestationUids(receipt);

    // Create attestation objects
    for (let i = 0; i < uids.length; i++) {
      const uid = uids[i];
      const request = requests[i];

      if (!request || !request.data[0]) {
        throw new AttestationError(
          'Invalid batch request data',
          'INVALID_BATCH_DATA',
          { index: i }
        );
      }

      const attestation: EasAttestation = {
        id: uuidv4(),
        uid,
        schemaId: this.config.defaultSchemaId,
        attester: this.config.attesterAddress,
        recipient: request.data[0].recipient,
        data: request._requestMetadata.originalData,
        encodedData: request.data[0].data,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        blockTimestamp: block.timestamp,
        chainId: this.config.chainId,
        status: 'confirmed' as AttestationStatus,
        revoked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Number(request.data[0].expirationTime) * 1000).toISOString(),
        metadata: {
          gasUsed: receipt.gasUsed.toString(),
          gasPrice: (receipt.gasPrice || '0').toString(),
          requestId: request._requestMetadata.requestId,
          batchIndex: i
        }
      };

      attestations.push(attestation);
    }

    return attestations;
  }

  private extractBatchAttestationUids(receipt: ethers.TransactionReceipt): string[] {
    const uids: string[] = [];
    
    for (const log of receipt.logs) {
      try {
        const iface = new ethers.Interface([
          'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 schema)'
        ]);
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'Attested') {
          uids.push(parsed.args.uid);
        }
      } catch {
        // Skip logs that don't match the event
        continue;
      }
    }

    return uids;
  }

  // ===== Transaction Retry Logic =====

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<{ transaction: T; receipt: ethers.TransactionReceipt }> {
    let lastError: Error | undefined;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const tx = await operation();
        if (!tx) {
          throw new Error(`${operationName} returned null transaction`);
        }

        // Wait for transaction confirmation
        const receipt = await (tx as any).wait();
        if (!receipt) {
          throw new Error(`${operationName} receipt not available`);
        }

        return { transaction: tx, receipt };
      } catch (error) {
        lastError = error as Error;
        
        // Check if we should retry
        if (this.shouldRetry(error) && attempt < maxRetries) {
          logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, {
            error: error instanceof Error ? error.message : String(error)
          });

          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
          continue;
        }

        break;
      }
    }

    throw new AttestationError(
      `${operationName} failed after ${maxRetries} attempts`,
      'MAX_RETRIES_EXCEEDED',
      { lastError: lastError?.message }
    );
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors, nonce issues, or gas price errors
    const retryableErrors = [
      'nonce',
      'replacement fee too low',
      'network error',
      'timeout',
      'transaction underpriced',
      'already known'
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(msg => errorMessage.includes(msg));
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

      const txHash = await tx.wait();

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
    try {
      // Store in database first
      await this.storeAttestationInDb(attestation);

      // If Arweave storage is configured, store there as well
      if (this.arweaveService) {
        const arweaveData = await this.arweaveService.uploadData({
          data: Buffer.from(JSON.stringify(attestation)),
          contentType: 'application/json',
          tags: [
            { name: 'OneKey-Type', value: 'attestation' },
            { name: 'OneKey-Attestation-UID', value: attestation.uid },
            { name: 'OneKey-Schema-ID', value: attestation.schemaId },
            { name: 'OneKey-Recipient', value: attestation.recipient }
          ],
          metadata: {
            uploadedBy: attestation.attester,
            uploadTimestamp: attestation.createdAt,
            dataHash: crypto.createHash('sha256').update(JSON.stringify(attestation)).digest('hex'),
            category: 'attestation_metadata',
            description: `Attestation ${attestation.uid} for ${attestation.recipient}`
          },
          permanent: true
        });

        // Update attestation with Arweave transaction ID
        attestation.metadata.arweaveTransactionId = arweaveData.transactionId;
        await this.updateAttestationInDb(attestation);

        logger.info('Attestation stored in Arweave', {
          uid: attestation.uid,
          transactionId: arweaveData.transactionId
        });
      }
    } catch (error) {
      logger.error('Failed to store attestation', {
        uid: attestation.uid,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  private async storeAttestationInDb(attestation: EasAttestation): Promise<void> {
    // TODO: Implement database storage
    logger.info('Storing attestation in database', { uid: attestation.uid });
  }

  private async updateAttestationInDb(attestation: EasAttestation): Promise<void> {
    // TODO: Implement database update
    logger.info('Updating attestation in database', { uid: attestation.uid });
  }

  private async validateRequest(request: CreateAttestationRequest): Promise<void> {
    if (!request.recipient || !ethers.isAddress(request.recipient)) {
      throw new AttestationError(
        'Invalid recipient address',
        'INVALID_RECIPIENT',
        { recipient: request.recipient }
      );
    }

    if (!request.kycResult) {
      throw new AttestationError(
        'KYC result is required',
        'MISSING_KYC_RESULT'
      );
    }

    // Additional validation as needed
  }
} 
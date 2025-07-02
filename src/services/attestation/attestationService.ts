// OneKey KYC API - Attestation Service Manager
// Orchestrates multiple attestation providers and provides unified interface

import { v4 as uuidv4 } from 'uuid';
import { EasService } from './easService';
import {
  EasAttestation,
  CreateAttestationRequest,
  AttestationVerificationResult,
  AttestationError,
  EasConfig,
  GasEstimate,
  AttestationStats,
  AttestationListResponse,
  RevokeAttestationRequest,
  VerifyAttestationRequest,
  CreateAttestationResponse,
  GetAttestationResponse,
  AttestationApiResponse
} from '../../types/attestation';
import { KycVerificationResult } from '../../types/kyc';
import { config } from '../../config/environment';
import { logger } from '../../utils/logger';

export class AttestationService {
  private easService: EasService;
  private isInitialized: boolean = false;
  private attestationCache: Map<string, EasAttestation> = new Map();

  constructor() {
    // Initialize EAS service with configuration
    const easConfig: EasConfig = {
      chainId: config.blockchain.chainId,
      rpcUrl: config.blockchain.rpcUrl,
      contractAddress: config.blockchain.easContractAddress,
      schemaRegistryAddress: config.blockchain.easSchemaRegistryAddress,
      attesterPrivateKey: config.blockchain.attesterPrivateKey,
      attesterAddress: config.blockchain.attesterAddress,
      defaultSchemaId: config.blockchain.easSchemaId,
      gasLimit: 500000,
      gasPrice: '20', // Default gas price in gwei
      gasPriceStrategy: 'estimate',
      enableRevocation: true,
      defaultExpirationHours: 365 * 24, // 1 year
      autoCreateOnKyc: true,
      maxAttestationsPerHour: 50,
      maxAttestationsPerDay: 200
    };

    this.easService = new EasService(easConfig);
  }

  // ===== Initialization =====

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing attestation service');

      // Initialize EAS service
      await this.easService.initialize();

      this.isInitialized = true;
      logger.info('Attestation service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize attestation service', { error });
      throw new AttestationError(
        'Attestation service initialization failed',
        'INITIALIZATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Public API Methods =====

  /**
   * Create attestation after successful KYC verification
   */
  public async createAttestationFromKyc(
    userWalletAddress: string,
    kycResult: KycVerificationResult,
    options?: {
      autoCreate?: boolean;
      expirationHours?: number;
      metadata?: Record<string, any>;
    }
  ): Promise<CreateAttestationResponse> {
    const requestId = uuidv4();
    
    try {
      await this.ensureInitialized();

      logger.info('Creating attestation from KYC result', {
        requestId,
        userWallet: userWalletAddress,
        kycSessionId: kycResult.sessionId,
        kycProvider: kycResult.provider,
        kycStatus: kycResult.status
      });

      // Validate KYC result
      if (kycResult.status !== 'completed') {
        throw new AttestationError(
          'KYC verification must be completed successfully before creating attestation',
          'KYC_NOT_VERIFIED',
          { kycStatus: kycResult.status, sessionId: kycResult.sessionId }
        );
      }

      // Calculate expiration time
      const expirationTime = options?.expirationHours 
        ? Math.floor(Date.now() / 1000) + (options.expirationHours * 3600)
        : undefined;

      // Create attestation request
      const request: CreateAttestationRequest = {
        recipient: userWalletAddress,
        kycResult,
        options: {
          revocable: true,
          ...(expirationTime !== undefined && { expirationTime }),
          ...(options?.metadata && { offChainMetadata: options.metadata })
        },
        requestId,
        timestamp: Date.now()
      };

      // Create attestation using EAS service
      const attestation = await this.easService.createKycAttestation(
        userWalletAddress,
        kycResult,
        request.options
      );

      // Cache the attestation
      this.attestationCache.set(attestation.uid, attestation);

      logger.info('Attestation created successfully', {
        requestId,
        uid: attestation.uid,
        transactionHash: attestation.transactionHash,
        gasUsed: attestation.metadata.gasUsed
      });

      return {
        success: true,
        data: {
          attestation,
          transactionHash: attestation.transactionHash,
          gasUsed: Number(attestation.metadata.gasUsed),
          cost: {
            gasPrice: attestation.metadata.gasPrice || '0',
            gasLimit: Number(attestation.metadata.gasUsed),
            totalCost: '0' // Would be calculated from actual gas price
          }
        },
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to create attestation from KYC', {
        requestId,
        userWallet: userWalletAddress,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: error instanceof AttestationError ? error.code : 'ATTESTATION_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: error instanceof AttestationError ? error.details : undefined
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get attestation by UID
   */
  public async getAttestation(uid: string): Promise<GetAttestationResponse> {
    const requestId = uuidv4();

    try {
      await this.ensureInitialized();

      logger.info('Getting attestation', { requestId, uid });

      // Check cache first
      let attestation = this.attestationCache.get(uid);

      if (!attestation) {
        // Verify on-chain and get attestation data
        const verificationResult = await this.easService.verifyAttestation(uid);
        
        if (!verificationResult.valid || !verificationResult.attestation) {
          throw new AttestationError(
            'Attestation not found or invalid',
            'ATTESTATION_NOT_FOUND',
            { uid, verification: verificationResult.verification }
          );
        }

        attestation = verificationResult.attestation;
        this.attestationCache.set(uid, attestation);
      }

      return {
        success: true,
        data: attestation,
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to get attestation', {
        requestId,
        uid,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: error instanceof AttestationError ? error.code : 'ATTESTATION_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify attestation validity
   */
  public async verifyAttestation(
    request: VerifyAttestationRequest
  ): Promise<AttestationApiResponse<AttestationVerificationResult>> {
    const requestId = uuidv4();

    try {
      await this.ensureInitialized();

      if (!request.uid) {
        throw new AttestationError(
          'Attestation UID is required for verification',
          'MISSING_UID'
        );
      }

      logger.info('Verifying attestation', { requestId, uid: request.uid });

      const verificationResult = await this.easService.verifyAttestation(request.uid);

      logger.info('Attestation verification completed', {
        requestId,
        uid: request.uid,
        valid: verificationResult.valid
      });

      return {
        success: true,
        data: verificationResult,
        requestId,
        timestamp: new Date().toISOString(),
        blockchain: {
          chainId: config.blockchain.chainId,
          blockNumber: verificationResult.details.blockNumber
        }
      };

    } catch (error) {
      logger.error('Failed to verify attestation', {
        requestId,
        uid: request.uid,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: error instanceof AttestationError ? error.code : 'ATTESTATION_VERIFICATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * List attestations for a recipient
   */
  public async listAttestations(
    recipient: string,
    options?: {
      limit?: number;
      offset?: number;
      includeRevoked?: boolean;
      includeExpired?: boolean;
    }
  ): Promise<AttestationListResponse> {
    const requestId = uuidv4();

    try {
      await this.ensureInitialized();

      logger.info('Listing attestations', { requestId, recipient, options });

      // TODO: Implement database query to list attestations
      // For now, return empty list as placeholder
      
      const attestations: EasAttestation[] = [];
      const total = 0;
      const limit = options?.limit || 10;
      const offset = options?.offset || 0;

      return {
        success: true,
        data: {
          attestations,
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          hasNext: offset + limit < total
        },
        requestId,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to list attestations', {
        requestId,
        recipient,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: 'ATTESTATION_LIST_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Revoke an attestation
   */
  public async revokeAttestation(
    request: RevokeAttestationRequest
  ): Promise<AttestationApiResponse<boolean>> {
    const requestId = uuidv4();

    try {
      await this.ensureInitialized();

      logger.info('Revoking attestation', { requestId, uid: request.uid, reason: request.reason });

      const success = await this.easService.revokeAttestation(request.uid, request.reason);

      // Remove from cache
      this.attestationCache.delete(request.uid);

      logger.info('Attestation revoked successfully', { requestId, uid: request.uid });

      return {
        success: true,
        data: success,
        requestId,
        timestamp: new Date().toISOString(),
        blockchain: {
          chainId: config.blockchain.chainId,
          blockNumber: 0 // Would be filled with actual block number
        }
      };

    } catch (error) {
      logger.error('Failed to revoke attestation', {
        requestId,
        uid: request.uid,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: error instanceof AttestationError ? error.code : 'ATTESTATION_REVOCATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Estimate gas cost for creating an attestation
   */
  public async estimateAttestationCost(
    recipient: string,
    kycResult: KycVerificationResult
  ): Promise<AttestationApiResponse<GasEstimate>> {
    const requestId = uuidv4();

    try {
      await this.ensureInitialized();

      const request: CreateAttestationRequest = {
        recipient,
        kycResult,
        requestId,
        timestamp: Date.now()
      };

      const gasEstimate = await this.easService.estimateAttestationCost(request);

      return {
        success: true,
        data: gasEstimate,
        requestId,
        timestamp: new Date().toISOString(),
        blockchain: {
          chainId: config.blockchain.chainId,
          blockNumber: 0
        }
      };

    } catch (error) {
      logger.error('Failed to estimate attestation cost', {
        requestId,
        recipient,
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        success: false,
        error: {
          code: 'GAS_ESTIMATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        requestId,
        timestamp: new Date().toISOString()
      };
    }
  }

  // ===== Health & Status =====

  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      eas: Awaited<ReturnType<EasService['getHealthStatus']>>;
    };
    details: {
      initialized: boolean;
      cacheSize: number;
      attestationCount: number;
    };
  }> {
    try {
      const easHealth = await this.easService.getHealthStatus();

      return {
        status: easHealth.status,
        services: {
          eas: easHealth
        },
        details: {
          initialized: this.isInitialized,
          cacheSize: this.attestationCache.size,
          attestationCount: 0 // Would come from database
        }
      };
    } catch (error) {
      logger.error('Attestation service health check failed', { error });

      return {
        status: 'unhealthy',
        services: {
          eas: {
            status: 'unhealthy',
            details: {
              initialized: false,
              chainId: config.blockchain.chainId,
              attesterAddress: config.blockchain.attesterAddress,
              responseTime: 0
            }
          }
        },
        details: {
          initialized: this.isInitialized,
          cacheSize: this.attestationCache.size,
          attestationCount: 0
        }
      };
    }
  }

  public getStats(): AttestationStats {
    return this.easService.getStats();
  }

  // ===== Helper Methods =====

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      throw new AttestationError(
        'Attestation service not initialized',
        'NOT_INITIALIZED'
      );
    }
  }

  /**
   * Auto-create attestation after successful KYC (if enabled)
   */
  public async handleKycCompletion(
    userWalletAddress: string,
    kycResult: KycVerificationResult
  ): Promise<EasAttestation | null> {
    try {
      if (kycResult.status !== 'completed') {
        logger.info('KYC not verified, skipping auto-attestation', {
          sessionId: kycResult.sessionId,
          status: kycResult.status
        });
        return null;
      }

      logger.info('Auto-creating attestation after KYC completion', {
        userWallet: userWalletAddress,
        kycSessionId: kycResult.sessionId,
        provider: kycResult.provider
      });

      const response = await this.createAttestationFromKyc(userWalletAddress, kycResult, {
        autoCreate: true,
        metadata: {
          autoCreated: true,
          trigger: 'kyc_completion'
        }
      });

      if (response.success && response.data) {
        logger.info('Auto-attestation created successfully', {
          uid: response.data.attestation.uid,
          transactionHash: response.data.transactionHash
        });
        return response.data.attestation;
      } else {
        logger.error('Auto-attestation failed', {
          error: response.error
        });
        return null;
      }

    } catch (error) {
      logger.error('Failed to handle KYC completion for attestation', {
        userWallet: userWalletAddress,
        kycSessionId: kycResult.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      return null;
    }
  }
} 
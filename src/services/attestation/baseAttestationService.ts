// OneKey KYC API - Base Attestation Service
// Abstract base class for blockchain attestation services

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  AttestationData,
  EasAttestation,
  CreateAttestationRequest,
  AttestationVerificationResult,
  AttestationError,
  AttestationStatus,
  GasEstimate,
  EasConfig,
  ChainId,
  AttestationStats
} from '../../types/attestation';
import { KycVerificationResult, KycProvider } from '../../types/kyc';
import { config } from '../../config/environment';
import { logger } from '../../utils/logger';

export abstract class BaseAttestationService {
  protected config: EasConfig;
  protected provider: any; // ethers.Provider
  protected signer: any; // ethers.Signer
  protected isInitialized: boolean = false;
  protected attestationCount: Map<string, number> = new Map(); // Rate limiting tracking

  constructor(easConfig: EasConfig) {
    this.config = easConfig;
  }

  // ===== Abstract Methods (must be implemented by subclasses) =====

  protected abstract initializeProvider(): Promise<void>;
  protected abstract createAttestation(request: CreateAttestationRequest): Promise<EasAttestation>;
  protected abstract verifyOnChain(uid: string): Promise<AttestationVerificationResult>;
  protected abstract estimateGas(request: CreateAttestationRequest): Promise<GasEstimate>;
  protected abstract revokeAttestation(uid: string, reason?: string): Promise<boolean>;

  // ===== Initialization =====

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing base attestation service', {
        chainId: this.config.chainId,
        attester: this.config.attesterAddress
      });

      await this.initializeProvider();
      this.isInitialized = true;

      logger.info('Base attestation service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize attestation service', { error });
      throw new AttestationError(
        'Attestation service initialization failed',
        'INITIALIZATION_FAILED',
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Public Interface =====

  public async createKycAttestation(
    recipient: string,
    kycResult: KycVerificationResult,
    options?: CreateAttestationRequest['options']
  ): Promise<EasAttestation> {
    await this.ensureInitialized();
    await this.checkRateLimit(recipient);

    const request: CreateAttestationRequest = {
      recipient,
      kycResult,
      options: {
        revocable: true,
        expirationTime: this.calculateExpirationTime(),
        ...options
      },
      requestId: uuidv4(),
      timestamp: Date.now()
    };

    try {
      logger.info('Creating KYC attestation', {
        recipient,
        sessionId: kycResult.sessionId,
        provider: kycResult.provider,
        status: kycResult.status
      });

      const attestation = await this.createAttestation(request);
      
      // Update rate limit tracking
      this.updateRateLimit(recipient);

      logger.info('KYC attestation created successfully', {
        uid: attestation.uid,
        recipient: attestation.recipient,
        transactionHash: attestation.transactionHash
      });

      return attestation;
    } catch (error) {
      logger.error('Failed to create KYC attestation', {
        recipient,
        sessionId: kycResult.sessionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async verifyAttestation(uid: string): Promise<AttestationVerificationResult> {
    await this.ensureInitialized();

    try {
      logger.info('Verifying attestation', { uid });

      const result = await this.verifyOnChain(uid);

      logger.info('Attestation verification completed', {
        uid,
        valid: result.valid,
        onChain: result.verification.onChain,
        revoked: !result.verification.notRevoked
      });

      return result;
    } catch (error) {
      logger.error('Failed to verify attestation', {
        uid,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  public async estimateAttestationCost(request: CreateAttestationRequest): Promise<GasEstimate> {
    await this.ensureInitialized();
    
    try {
      return await this.estimateGas(request);
    } catch (error) {
      logger.error('Failed to estimate gas', {
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

  // ===== Data Transformation =====

  protected transformKycToAttestationData(
    kycResult: KycVerificationResult,
    recipient: string
  ): AttestationData {
    // Create privacy-preserving attestation data
    const userIdHash = this.hashUserId(kycResult.user.id || recipient);
    
    return {
      kycProvider: kycResult.provider,
      kycSessionId: kycResult.sessionId,
      verificationStatus: this.mapKycStatusToVerificationStatus(kycResult.status),
      verificationTimestamp: Math.floor(new Date(kycResult.createdAt).getTime() / 1000),
      confidenceScore: kycResult.confidence,
      
      // Zero-PII identity info
      userIdHash,
      countryCode: kycResult.document?.country || '',
      documentType: kycResult.document?.type || '',
      
      // Verification checks
      documentVerified: kycResult.checks?.documentAuthenticity?.status === 'passed',
      biometricVerified: kycResult.checks?.faceMatch?.status === 'passed',
      livenessVerified: kycResult.checks?.livenessDetection?.status === 'passed',
      addressVerified: kycResult.checks?.addressVerification?.status === 'passed',
      sanctionsCleared: kycResult.checks?.sanctions?.status === 'passed',
      pepCleared: kycResult.checks?.pep?.status === 'passed',
      
      // Risk assessment
      riskLevel: this.calculateRiskLevel(kycResult),
      riskScore: 0, // Calculate from checks
      
      // Attestation metadata
      schemaVersion: '1.0.0',
      apiVersion: config.api.version,
      attestationStandard: 'OneKey-KYC-v1.0'
    };
  }

  protected mapKycStatusToVerificationStatus(status: KycVerificationResult['status']): 'pending' | 'failed' | 'expired' | 'verified' {
    switch (status) {
      case 'completed': return 'verified';
      case 'failed': return 'failed';
      case 'expired': return 'expired';
      default: return 'pending';
    }
  }

  // ===== Utility Methods =====

  protected hashUserId(userId: string): string {
    // Create deterministic hash of user ID for privacy
    return crypto
      .createHash('sha256')
      .update(userId + config.security.hashSalt)
      .digest('hex');
  }

  protected calculateRiskLevel(kycResult: KycVerificationResult): 'low' | 'medium' | 'high' | 'critical' {
    const riskScore = kycResult.riskScore || 0;
    const confidenceScore = kycResult.confidenceScore;
    
    // Risk calculation logic
    if (riskScore > 70 || confidenceScore < 60) {
      return 'critical';
    } else if (riskScore > 40 || confidenceScore < 80) {
      return 'high';
    } else if (riskScore > 20 || confidenceScore < 90) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  protected calculateExpirationTime(): number {
    // Calculate expiration time based on config
    const hoursToAdd = this.config.defaultExpirationHours || (365 * 24); // Default 1 year
    return Math.floor(Date.now() / 1000) + (hoursToAdd * 3600);
  }

  // ===== Rate Limiting =====

  protected async checkRateLimit(recipient: string): Promise<void> {
    const now = Date.now();
    const hourKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60))}`;
    const dayKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60 * 24))}`;
    
    const hourlyCount = this.attestationCount.get(hourKey) || 0;
    const dailyCount = this.attestationCount.get(dayKey) || 0;
    
    if (hourlyCount >= this.config.maxAttestationsPerHour) {
      throw new AttestationError(
        'Hourly attestation limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        { limit: this.config.maxAttestationsPerHour, period: 'hour' }
      );
    }
    
    if (dailyCount >= this.config.maxAttestationsPerDay) {
      throw new AttestationError(
        'Daily attestation limit exceeded',
        'RATE_LIMIT_EXCEEDED',
        { limit: this.config.maxAttestationsPerDay, period: 'day' }
      );
    }
  }

  protected updateRateLimit(recipient: string): void {
    const now = Date.now();
    const hourKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60))}`;
    const dayKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60 * 24))}`;
    
    this.attestationCount.set(hourKey, (this.attestationCount.get(hourKey) || 0) + 1);
    this.attestationCount.set(dayKey, (this.attestationCount.get(dayKey) || 0) + 1);
  }

  // ===== Health & Status =====

  public async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      initialized: boolean;
      chainId: number;
      blockNumber?: number;
      attesterAddress: string;
      gasPrice?: string;
      responseTime: number;
    };
  }> {
    const startTime = Date.now();
    
    try {
      if (!this.isInitialized) {
        return {
          status: 'unhealthy',
          details: {
            initialized: false,
            chainId: this.config.chainId,
            attesterAddress: this.config.attesterAddress,
            responseTime: Date.now() - startTime
          }
        };
      }

      // Try to get current block number to test connectivity
      const blockNumber = await this.provider?.getBlockNumber?.();
      const gasPrice = await this.provider?.getGasPrice?.();

      return {
        status: 'healthy',
        details: {
          initialized: true,
          chainId: this.config.chainId,
          blockNumber,
          attesterAddress: this.config.attesterAddress,
          gasPrice: gasPrice?.toString(),
          responseTime: Date.now() - startTime
        }
      };
    } catch (error) {
      logger.error('Attestation service health check failed', { error });
      
      return {
        status: 'degraded',
        details: {
          initialized: this.isInitialized,
          chainId: this.config.chainId,
          attesterAddress: this.config.attesterAddress,
          responseTime: Date.now() - startTime
        }
      };
    }
  }

  public getStats(): AttestationStats {
    // This would typically come from database queries
    // For now, return placeholder stats
    return {
      totalAttestations: 0,
      verifiedAttestations: 0,
      revokedAttestations: 0,
      expiredAttestations: 0,
      successRate: 0,
      averageConfidenceScore: 0,
      providerStats: {
        'smile-identity': { count: 0, successRate: 0, averageScore: 0 },
        'onfido': { count: 0, successRate: 0, averageScore: 0 },
        'trulioo': { count: 0, successRate: 0, averageScore: 0 }
      },
      timeRange: {
        from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
        to: new Date().toISOString()
      }
    };
  }

  // ===== Helper Methods =====

  protected async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      throw new AttestationError(
        'Attestation service not initialized',
        'NOT_INITIALIZED'
      );
    }
  }

  protected generateRequestId(): string {
    return uuidv4();
  }

  protected logAttestationActivity(
    type: 'created' | 'verified' | 'revoked',
    uid: string,
    actor: string,
    metadata?: Record<string, any>
  ): void {
    logger.info('Attestation activity', {
      type,
      uid,
      actor,
      timestamp: new Date().toISOString(),
      metadata
    });
  }
} 
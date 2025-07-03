"use strict";
// OneKey KYC API - Base Attestation Service
// Abstract base class for blockchain attestation services
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseAttestationService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const attestation_1 = require("../../types/attestation");
const environment_1 = require("../../config/environment");
const logger_1 = require("../../utils/logger");
class BaseAttestationService {
    config;
    provider; // ethers.Provider
    signer; // ethers.Signer
    isInitialized = false;
    attestationCount = new Map(); // Rate limiting tracking
    constructor(easConfig) {
        this.config = easConfig;
    }
    // ===== Initialization =====
    async initialize() {
        try {
            logger_1.logger.info('Initializing base attestation service', {
                chainId: this.config.chainId,
                attester: this.config.attesterAddress
            });
            await this.initializeProvider();
            this.isInitialized = true;
            logger_1.logger.info('Base attestation service initialized successfully');
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize attestation service', { error });
            throw new attestation_1.AttestationError('Attestation service initialization failed', 'INITIALIZATION_FAILED', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Public Interface =====
    async createKycAttestation(recipient, kycResult, options) {
        await this.ensureInitialized();
        await this.checkRateLimit(recipient);
        const request = {
            recipient,
            kycResult,
            options: {
                revocable: true,
                expirationTime: this.calculateExpirationTime(),
                ...options
            },
            requestId: (0, uuid_1.v4)(),
            timestamp: Date.now()
        };
        try {
            logger_1.logger.info('Creating KYC attestation', {
                recipient,
                sessionId: kycResult.sessionId,
                provider: kycResult.provider,
                status: kycResult.status
            });
            const attestation = await this.createAttestation(request);
            // Update rate limit tracking
            this.updateRateLimit(recipient);
            logger_1.logger.info('KYC attestation created successfully', {
                uid: attestation.uid,
                recipient: attestation.recipient,
                transactionHash: attestation.transactionHash
            });
            return attestation;
        }
        catch (error) {
            logger_1.logger.error('Failed to create KYC attestation', {
                recipient,
                sessionId: kycResult.sessionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async verifyAttestation(uid) {
        await this.ensureInitialized();
        try {
            logger_1.logger.info('Verifying attestation', { uid });
            const result = await this.verifyOnChain(uid);
            logger_1.logger.info('Attestation verification completed', {
                uid,
                valid: result.valid,
                onChain: result.verification.onChain,
                revoked: !result.verification.notRevoked
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to verify attestation', {
                uid,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async estimateAttestationCost(request) {
        await this.ensureInitialized();
        try {
            return await this.estimateGas(request);
        }
        catch (error) {
            logger_1.logger.error('Failed to estimate gas', {
                recipient: request.recipient,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new attestation_1.AttestationError('Gas estimation failed', 'GAS_ESTIMATION_FAILED', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Data Transformation =====
    transformKycToAttestationData(kycResult, recipient) {
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
            countryCode: '', // Will be extracted from metadata if needed
            documentType: kycResult.document?.type || '',
            // Verification checks
            documentVerified: kycResult.checks?.documentAuthenticity?.status === 'pass',
            biometricVerified: kycResult.checks?.faceMatch?.status === 'pass',
            livenessVerified: kycResult.checks?.livenessDetection?.status === 'pass',
            addressVerified: kycResult.checks?.addressVerification?.status === 'pass',
            sanctionsCleared: kycResult.checks?.sanctions?.status === 'pass',
            pepCleared: kycResult.checks?.pep?.status === 'pass',
            // Risk assessment
            riskLevel: this.calculateRiskLevel(kycResult),
            riskScore: 0, // Calculate from checks
            // Attestation metadata
            schemaVersion: '1.0.0',
            apiVersion: environment_1.config.api.version,
            attestationStandard: 'OneKey-KYC-v1.0'
        };
    }
    mapKycStatusToVerificationStatus(status) {
        switch (status) {
            case 'completed': return 'verified';
            case 'failed': return 'failed';
            case 'expired': return 'expired';
            default: return 'pending';
        }
    }
    // ===== Utility Methods =====
    hashUserId(userId) {
        // Create deterministic hash of user ID for privacy
        return crypto_1.default
            .createHash('sha256')
            .update(userId + environment_1.config.security.hashSalt)
            .digest('hex');
    }
    calculateRiskLevel(kycResult) {
        const confidenceScore = kycResult.confidence;
        // Risk calculation based on confidence and check results
        if (confidenceScore < 60) {
            return 'critical';
        }
        else if (confidenceScore < 80) {
            return 'high';
        }
        else if (confidenceScore < 90) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    calculateExpirationTime() {
        // Calculate expiration time based on config
        const hoursToAdd = this.config.defaultExpirationHours || (365 * 24); // Default 1 year
        return Math.floor(Date.now() / 1000) + (hoursToAdd * 3600);
    }
    // ===== Rate Limiting =====
    async checkRateLimit(recipient) {
        const now = Date.now();
        const hourKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60))}`;
        const dayKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60 * 24))}`;
        const hourlyCount = this.attestationCount.get(hourKey) || 0;
        const dailyCount = this.attestationCount.get(dayKey) || 0;
        if (hourlyCount >= this.config.maxAttestationsPerHour) {
            throw new attestation_1.AttestationError('Hourly attestation limit exceeded', 'RATE_LIMIT_EXCEEDED', { limit: this.config.maxAttestationsPerHour, period: 'hour' });
        }
        if (dailyCount >= this.config.maxAttestationsPerDay) {
            throw new attestation_1.AttestationError('Daily attestation limit exceeded', 'RATE_LIMIT_EXCEEDED', { limit: this.config.maxAttestationsPerDay, period: 'day' });
        }
    }
    updateRateLimit(recipient) {
        const now = Date.now();
        const hourKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60))}`;
        const dayKey = `${recipient}-${Math.floor(now / (1000 * 60 * 60 * 24))}`;
        this.attestationCount.set(hourKey, (this.attestationCount.get(hourKey) || 0) + 1);
        this.attestationCount.set(dayKey, (this.attestationCount.get(dayKey) || 0) + 1);
    }
    // ===== Health & Status =====
    async getHealthStatus() {
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
        }
        catch (error) {
            logger_1.logger.error('Attestation service health check failed', { error });
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
    getStats() {
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
                'smile_identity': { count: 0, successRate: 0, averageScore: 0 },
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
    async ensureInitialized() {
        if (!this.isInitialized) {
            throw new attestation_1.AttestationError('Attestation service not initialized', 'NOT_INITIALIZED');
        }
    }
    generateRequestId() {
        return (0, uuid_1.v4)();
    }
    logAttestationActivity(type, uid, actor, metadata) {
        logger_1.logger.info('Attestation activity', {
            type,
            uid,
            actor,
            timestamp: new Date().toISOString(),
            metadata
        });
    }
}
exports.BaseAttestationService = BaseAttestationService;
//# sourceMappingURL=baseAttestationService.js.map
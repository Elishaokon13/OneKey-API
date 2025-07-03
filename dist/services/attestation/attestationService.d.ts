import { EasService } from './easService';
import { EasAttestation, AttestationVerificationResult, GasEstimate, AttestationStats, AttestationListResponse, RevokeAttestationRequest, VerifyAttestationRequest, CreateAttestationResponse, GetAttestationResponse, AttestationApiResponse } from '../../types/attestation';
import { KycVerificationResult } from '../../types/kyc';
export declare class AttestationService {
    private easService;
    private isInitialized;
    private attestationCache;
    constructor();
    initialize(): Promise<void>;
    /**
     * Create attestation after successful KYC verification
     */
    createAttestationFromKyc(userWalletAddress: string, kycResult: KycVerificationResult, options?: {
        autoCreate?: boolean;
        expirationHours?: number;
        metadata?: Record<string, any>;
    }): Promise<CreateAttestationResponse>;
    /**
     * Get attestation by UID
     */
    getAttestation(uid: string): Promise<GetAttestationResponse>;
    /**
     * Verify attestation validity
     */
    verifyAttestation(request: VerifyAttestationRequest): Promise<AttestationApiResponse<AttestationVerificationResult>>;
    /**
     * List attestations for a recipient
     */
    listAttestations(recipient: string, options?: {
        limit?: number;
        offset?: number;
        includeRevoked?: boolean;
        includeExpired?: boolean;
    }): Promise<AttestationListResponse>;
    /**
     * Revoke an attestation
     */
    revokeAttestation(request: RevokeAttestationRequest): Promise<AttestationApiResponse<boolean>>;
    /**
     * Estimate gas cost for creating an attestation
     */
    estimateAttestationCost(recipient: string, kycResult: KycVerificationResult): Promise<AttestationApiResponse<GasEstimate>>;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        services: {
            eas: Awaited<ReturnType<EasService['getHealthStatus']>>;
        };
        details: {
            initialized: boolean;
            cacheSize: number;
            attestationCount: number;
        };
    }>;
    getStats(): AttestationStats;
    private ensureInitialized;
    /**
     * Auto-create attestation after successful KYC (if enabled)
     */
    handleKycCompletion(userWalletAddress: string, kycResult: KycVerificationResult): Promise<EasAttestation | null>;
}
//# sourceMappingURL=attestationService.d.ts.map
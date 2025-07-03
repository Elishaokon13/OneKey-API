import { AttestationData, EasAttestation, CreateAttestationRequest, AttestationVerificationResult, GasEstimate, EasConfig, AttestationStats } from '../../types/attestation';
import { KycVerificationResult } from '../../types/kyc';
export declare abstract class BaseAttestationService {
    protected config: EasConfig;
    protected provider: any;
    protected signer: any;
    protected isInitialized: boolean;
    protected attestationCount: Map<string, number>;
    constructor(easConfig: EasConfig);
    protected abstract initializeProvider(): Promise<void>;
    protected abstract createAttestation(request: CreateAttestationRequest): Promise<EasAttestation>;
    protected abstract verifyOnChain(uid: string): Promise<AttestationVerificationResult>;
    protected abstract estimateGas(request: CreateAttestationRequest): Promise<GasEstimate>;
    protected abstract revokeAttestation(uid: string, reason?: string): Promise<boolean>;
    initialize(): Promise<void>;
    createKycAttestation(recipient: string, kycResult: KycVerificationResult, options?: CreateAttestationRequest['options']): Promise<EasAttestation>;
    verifyAttestation(uid: string): Promise<AttestationVerificationResult>;
    estimateAttestationCost(request: CreateAttestationRequest): Promise<GasEstimate>;
    protected transformKycToAttestationData(kycResult: KycVerificationResult, recipient: string): AttestationData;
    protected mapKycStatusToVerificationStatus(status: KycVerificationResult['status']): 'pending' | 'failed' | 'expired' | 'verified';
    protected hashUserId(userId: string): string;
    protected calculateRiskLevel(kycResult: KycVerificationResult): 'low' | 'medium' | 'high' | 'critical';
    protected calculateExpirationTime(): number;
    protected checkRateLimit(recipient: string): Promise<void>;
    protected updateRateLimit(recipient: string): void;
    getHealthStatus(): Promise<{
        status: 'healthy' | 'degraded' | 'unhealthy';
        details: {
            initialized: boolean;
            chainId: number;
            blockNumber?: number;
            attesterAddress: string;
            gasPrice?: string;
            responseTime: number;
        };
    }>;
    getStats(): AttestationStats;
    protected ensureInitialized(): Promise<void>;
    protected generateRequestId(): string;
    protected logAttestationActivity(type: 'created' | 'verified' | 'revoked', uid: string, actor: string, metadata?: Record<string, any>): void;
}
//# sourceMappingURL=baseAttestationService.d.ts.map
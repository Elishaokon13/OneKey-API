import { KycSession, KycVerificationResult, CreateKycSessionRequest, KycProvider, KycProviderConfig } from '@/types/kyc';
export declare class KycService {
    private providers;
    constructor();
    private initializeProviders;
    selectProvider(request: CreateKycSessionRequest): KycProvider;
    createSession(request: CreateKycSessionRequest): Promise<KycSession>;
    startVerification(sessionId: string): Promise<KycVerificationResult>;
    getAvailableProviders(): KycProviderConfig[];
    getProvidersHealth(): Promise<Record<KycProvider, any>>;
    private getProviderService;
}
//# sourceMappingURL=kycService.d.ts.map
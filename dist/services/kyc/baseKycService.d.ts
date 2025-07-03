import { KycSession, KycVerificationResult, CreateKycSessionRequest, UpdateKycSessionRequest, KycProvider, KycProviderConfig } from '../../types/kyc';
export interface IKycService {
    provider: KycProvider;
    createSession(request: CreateKycSessionRequest): Promise<KycSession>;
    getSession(sessionId: string): Promise<KycSession>;
    updateSession(sessionId: string, updates: UpdateKycSessionRequest): Promise<KycSession>;
    startVerification(sessionId: string): Promise<KycVerificationResult>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
}
export declare abstract class BaseKycService implements IKycService {
    abstract provider: KycProvider;
    protected config: KycProviderConfig;
    protected sessions: Map<string, KycSession>;
    constructor(config: KycProviderConfig);
    createSession(request: CreateKycSessionRequest): Promise<KycSession>;
    getSession(sessionId: string): Promise<KycSession>;
    updateSession(sessionId: string, updates: UpdateKycSessionRequest): Promise<KycSession>;
    startVerification(sessionId: string): Promise<KycVerificationResult>;
    healthCheck(): Promise<{
        status: 'healthy' | 'unhealthy';
        details: Record<string, any>;
    }>;
    protected generateSessionId(): string;
    getProviderConfig(): KycProviderConfig;
    protected abstract createProviderSession(session: KycSession, request: CreateKycSessionRequest): Promise<void>;
    protected abstract performVerification(session: KycSession): Promise<KycVerificationResult>;
    protected abstract checkProviderHealth(): Promise<Record<string, any>>;
}
//# sourceMappingURL=baseKycService.d.ts.map
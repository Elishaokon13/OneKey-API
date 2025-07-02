import { BaseKycService } from './baseKycService';
import { KycSession, KycVerificationResult, CreateKycSessionRequest, KycProvider } from '@/types/kyc';
export declare class OnfidoService extends BaseKycService {
    provider: KycProvider;
    constructor();
    protected createProviderSession(session: KycSession, request: CreateKycSessionRequest): Promise<void>;
    protected performVerification(session: KycSession): Promise<KycVerificationResult>;
    protected checkProviderHealth(): Promise<Record<string, any>>;
}
//# sourceMappingURL=onfidoService.d.ts.map
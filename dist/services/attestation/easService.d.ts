import { BaseAttestationService } from './baseAttestationService';
import { EasAttestation, CreateAttestationRequest, AttestationVerificationResult, GasEstimate, EasConfig } from '../../types/attestation';
export declare class EasService extends BaseAttestationService {
    private eas;
    private schemaEncoder;
    private readonly SCHEMA_DEFINITION;
    constructor(easConfig: EasConfig);
    protected initializeProvider(): Promise<void>;
    protected createAttestation(request: CreateAttestationRequest): Promise<EasAttestation>;
    protected verifyOnChain(uid: string): Promise<AttestationVerificationResult>;
    protected estimateGas(request: CreateAttestationRequest): Promise<GasEstimate>;
    revokeAttestation(uid: string, reason?: string): Promise<boolean>;
    private encodeAttestationData;
    private extractAttestationUid;
    private parseOnChainAttestation;
    private getVerificationErrors;
    private estimateConfirmationTime;
    private storeAttestation;
    private updateAttestationStatus;
}
//# sourceMappingURL=easService.d.ts.map
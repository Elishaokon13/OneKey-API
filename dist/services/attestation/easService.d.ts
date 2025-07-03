import { BaseAttestationService } from './baseAttestationService';
import { EasAttestation, CreateAttestationRequest, AttestationVerificationResult, GasEstimate, EasConfig } from '../../types/attestation';
export declare class EasService extends BaseAttestationService {
    private readonly arweaveConfig?;
    private eas;
    private schemaEncoder;
    private schemaManager;
    private arweaveService?;
    private readonly SCHEMA_DEFINITION;
    constructor(easConfig: EasConfig, arweaveConfig?: any | undefined);
    protected initializeProvider(): Promise<void>;
    private validateDefaultSchema;
    protected createAttestation(request: CreateAttestationRequest): Promise<EasAttestation>;
    createBatchAttestations(requests: CreateAttestationRequest[]): Promise<EasAttestation[]>;
    private processBatchReceipt;
    private extractBatchAttestationUids;
    private executeWithRetry;
    private shouldRetry;
    protected verifyOnChain(uid: string): Promise<AttestationVerificationResult>;
    protected estimateGas(request: CreateAttestationRequest): Promise<GasEstimate>;
    revokeAttestation(uid: string, reason?: string): Promise<boolean>;
    private encodeAttestationData;
    private extractAttestationUid;
    private parseOnChainAttestation;
    private getVerificationErrors;
    private estimateConfirmationTime;
    private storeAttestation;
    private storeAttestationInDb;
    private updateAttestationInDb;
    private validateRequest;
}
//# sourceMappingURL=easService.d.ts.map
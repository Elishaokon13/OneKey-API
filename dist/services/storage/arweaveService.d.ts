import { ArweaveConfig, ArweaveStorageRequest, ArweaveStorageResponse, ArweaveRetrievalRequest, ArweaveRetrievalResponse, ArweaveHealthStatus, ArweaveUsageStats, AttestationArweaveStorage, KycArweaveStorage } from '../../types/arweave';
export declare class ArweaveService {
    private arweave;
    private wallet;
    private config;
    private cache;
    private stats;
    constructor(arweaveConfig: ArweaveConfig);
    private initializeArweave;
    private initializeWallet;
    private initializeStats;
    uploadData(request: ArweaveStorageRequest): Promise<ArweaveStorageResponse>;
    retrieveData(request: ArweaveRetrievalRequest): Promise<ArweaveRetrievalResponse>;
    getHealthStatus(): Promise<ArweaveHealthStatus>;
    storeAttestationData(attestationId: string, metadata: any, documents: Buffer[]): Promise<AttestationArweaveStorage>;
    storeKycData(sessionId: string, encryptedData: Buffer, documents: Buffer[]): Promise<KycArweaveStorage>;
    private estimateConfirmationTime;
    private updateUploadStats;
    private updateRetrievalStats;
    getStats(): ArweaveUsageStats;
}
//# sourceMappingURL=arweaveService.d.ts.map
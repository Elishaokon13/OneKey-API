import { EventEmitter } from 'events';
import { OneKeyConfig, KycProvider, KycSession, KycStatus, DocumentType, AttestationSchema, AttestationRecord, CryptoProvider } from '../types';
export declare class OneKeySDK extends EventEmitter {
    private httpClient;
    private config;
    private isInitialized;
    constructor(config: OneKeyConfig);
    /**
     * Initialize the SDK - performs initial authentication and health checks
     */
    initialize(): Promise<void>;
    /**
     * Authenticate with API key
     */
    authenticate(apiKey: string): Promise<void>;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<OneKeyConfig>;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<OneKeyConfig>): void;
    /**
     * Check if SDK is initialized
     */
    get initialized(): boolean;
    /**
     * KYC Methods
     */
    /**
     * Get available KYC providers
     */
    getKycProviders(): Promise<KycProvider[]>;
    /**
     * Create a new KYC session
     */
    createKycSession(provider: string, options?: {
        userId?: string;
        metadata?: Record<string, any>;
        webhookUrl?: string;
    }): Promise<KycSession>;
    /**
     * Get KYC session status
     */
    getKycSession(sessionId: string): Promise<KycSession>;
    /**
     * Upload document for KYC
     */
    uploadKycDocument(sessionId: string, documentType: DocumentType, file: File | Buffer, options?: {
        filename?: string;
        metadata?: Record<string, any>;
    }): Promise<{
        documentId: string;
        status: string;
    }>;
    /**
     * Get KYC status for a user
     */
    getKycStatus(userId: string): Promise<KycStatus>;
    /**
     * Attestation Methods
     */
    /**
     * Get available attestation schemas
     */
    getAttestationSchemas(): Promise<AttestationSchema[]>;
    /**
     * Create a new attestation
     */
    createAttestation(schemaId: string, recipient: string, data: Record<string, any>, options?: {
        expirationTime?: number;
        revocable?: boolean;
        metadata?: Record<string, any>;
    }): Promise<AttestationRecord>;
    /**
     * Get attestation by ID
     */
    getAttestation(attestationId: string): Promise<AttestationRecord>;
    /**
     * Query attestations
     */
    queryAttestations(query: {
        recipient?: string;
        schemaId?: string;
        attester?: string;
        limit?: number;
        offset?: number;
    }): Promise<{
        attestations: AttestationRecord[];
        total: number;
    }>;
    /**
     * Revoke an attestation
     */
    revokeAttestation(attestationId: string, reason?: string): Promise<void>;
    /**
     * Verify an attestation
     */
    verifyAttestation(attestationId: string): Promise<{
        valid: boolean;
        issues?: string[];
    }>;
    /**
     * Encryption Methods
     */
    /**
     * Get available crypto providers
     */
    getCryptoProviders(): Promise<CryptoProvider[]>;
    /**
     * Encrypt data
     */
    encryptData(data: string | object, options?: {
        provider?: string;
        keyId?: string;
        algorithm?: string;
    }): Promise<{
        encrypted: string;
        keyId: string;
        algorithm: string;
        metadata?: Record<string, any>;
    }>;
    /**
     * Decrypt data
     */
    decryptData(encryptedData: string, keyId: string, options?: {
        algorithm?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Storage Methods
     */
    /**
     * Store data securely
     */
    storeData(data: string | object, options?: {
        encrypt?: boolean;
        provider?: string;
        metadata?: Record<string, any>;
        ttl?: number;
    }): Promise<{
        id: string;
        url?: string;
        hash?: string;
        metadata?: Record<string, any>;
    }>;
    /**
     * Retrieve stored data
     */
    retrieveData(id: string, options?: {
        decrypt?: boolean;
    }): Promise<string>;
    /**
     * Private helper methods
     */
    private validateConfig;
    private validateApiKey;
    /**
     * Cleanup method
     */
    destroy(): void;
}
export declare function createOneKeySDK(config: OneKeyConfig): OneKeySDK;
//# sourceMappingURL=onekey-sdk.d.ts.map
import { KycVerificationResult, KycProvider } from './kyc';
export interface AttestationData {
    kycProvider: KycProvider;
    kycSessionId: string;
    verificationStatus: 'verified' | 'failed' | 'pending' | 'expired';
    verificationTimestamp: number;
    confidenceScore: number;
    userIdHash: string;
    countryCode?: string;
    documentType?: string;
    documentVerified: boolean;
    biometricVerified: boolean;
    livenessVerified: boolean;
    addressVerified: boolean;
    sanctionsCleared: boolean;
    pepCleared: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    riskScore: number;
    schemaVersion: string;
    apiVersion: string;
    attestationStandard: string;
}
export interface CreateAttestationRequest {
    recipient: string;
    kycResult: KycVerificationResult;
    options?: {
        revocable?: boolean;
        expirationTime?: number;
        onChainMetadata?: Record<string, any>;
        offChainMetadata?: Record<string, any>;
    };
    requestId?: string;
    timestamp?: number;
    ipAddress?: string;
    userAgent?: string;
}
export interface EasAttestation {
    id: string;
    uid: string;
    schemaId: string;
    attester: string;
    recipient: string;
    data: AttestationData;
    encodedData: string;
    transactionHash: string;
    blockNumber: number;
    blockTimestamp: number;
    chainId: number;
    status: AttestationStatus;
    revoked: boolean;
    revokedAt?: number;
    revokedBy?: string;
    revokedReason?: string;
    createdAt: string;
    updatedAt: string;
    expiresAt?: string;
    metadata: Record<string, any>;
}
export interface AttestationVerificationResult {
    valid: boolean;
    attestation?: EasAttestation;
    verification: {
        onChain: boolean;
        schemaValid: boolean;
        notRevoked: boolean;
        notExpired: boolean;
        attesterValid: boolean;
        recipientMatch: boolean;
    };
    details: {
        checkedAt: string;
        blockNumber: number;
        gasUsed?: number;
        verificationTime: number;
    };
    errors?: string[];
}
export interface AttestationSchema {
    id: string;
    name: string;
    description: string;
    version: string;
    schema: string;
    resolver?: string;
    revocable: boolean;
    fields: AttestationSchemaField[];
    createdAt: string;
    creator: string;
    registrationTransaction: string;
}
export interface AttestationSchemaField {
    name: string;
    type: 'uint256' | 'int256' | 'bool' | 'string' | 'bytes' | 'address' | 'bytes32';
    description: string;
    required: boolean;
    indexed?: boolean;
}
export interface CreateAttestationResponse {
    success: boolean;
    data?: {
        attestation: EasAttestation;
        transactionHash: string;
        gasUsed: number;
        cost: {
            gasPrice: string;
            gasLimit: number;
            totalCost: string;
        };
    };
    error?: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    requestId: string;
    timestamp: string;
}
export interface GetAttestationResponse {
    success: boolean;
    data?: EasAttestation;
    error?: {
        code: string;
        message: string;
    };
    requestId: string;
    timestamp: string;
}
export interface AttestationListResponse {
    success: boolean;
    data?: {
        attestations: EasAttestation[];
        total: number;
        page: number;
        limit: number;
        hasNext: boolean;
    };
    error?: {
        code: string;
        message: string;
    };
    requestId: string;
    timestamp: string;
}
export interface RevokeAttestationRequest {
    uid: string;
    reason?: string;
    metadata?: Record<string, any>;
}
export interface VerifyAttestationRequest {
    uid?: string;
    recipient?: string;
    schemaId?: string;
    includeRevoked?: boolean;
    includeExpired?: boolean;
}
export interface EasConfig {
    chainId: number;
    rpcUrl: string;
    contractAddress: string;
    schemaRegistryAddress: string;
    attesterPrivateKey: string;
    attesterAddress: string;
    defaultSchemaId: string;
    gasLimit: number;
    gasPrice?: string;
    gasPriceStrategy: 'fixed' | 'estimate' | 'fast' | 'standard' | 'slow';
    enableRevocation: boolean;
    defaultExpirationHours: number;
    autoCreateOnKyc: boolean;
    maxAttestationsPerHour: number;
    maxAttestationsPerDay: number;
}
export declare class AttestationError extends Error {
    code: string;
    details?: Record<string, any> | undefined;
    constructor(message: string, code: string, details?: Record<string, any> | undefined);
}
export declare class AttestationCreationError extends AttestationError {
    transactionHash?: string | undefined;
    gasUsed?: number | undefined;
    constructor(message: string, transactionHash?: string | undefined, gasUsed?: number | undefined, details?: Record<string, any>);
}
export declare class AttestationVerificationError extends AttestationError {
    uid?: string | undefined;
    constructor(message: string, uid?: string | undefined, details?: Record<string, any>);
}
export declare class AttestationNotFoundError extends AttestationError {
    constructor(uid: string);
}
export declare class SchemaError extends AttestationError {
    schemaId?: string | undefined;
    constructor(message: string, schemaId?: string | undefined, details?: Record<string, any>);
}
export declare class BlockchainError extends AttestationError {
    chainId?: number | undefined;
    blockNumber?: number | undefined;
    constructor(message: string, chainId?: number | undefined, blockNumber?: number | undefined, details?: Record<string, any>);
}
export type AttestationStatus = 'pending' | 'confirmed' | 'failed' | 'revoked' | 'expired';
export type ChainId = 1 | 5 | 11155111 | 8453 | 84532 | 10 | 420;
export interface GasEstimate {
    gasLimit: number;
    gasPrice: string;
    totalCost: string;
    estimatedConfirmationTime: number;
}
export interface AttestationStats {
    totalAttestations: number;
    verifiedAttestations: number;
    revokedAttestations: number;
    expiredAttestations: number;
    successRate: number;
    averageConfidenceScore: number;
    providerStats: Record<KycProvider, {
        count: number;
        successRate: number;
        averageScore: number;
    }>;
    timeRange: {
        from: string;
        to: string;
    };
}
export interface AttestationActivity {
    type: 'created' | 'verified' | 'revoked' | 'expired';
    attestationUid: string;
    timestamp: string;
    actor: string;
    metadata?: Record<string, any>;
}
export type AttestationApiResponse<T = any> = {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    requestId: string;
    timestamp: string;
    blockchain?: {
        chainId: number;
        blockNumber: number;
        gasUsed?: number;
        transactionHash?: string;
    };
};
export interface SchemaConfig {
    rpcUrl: string;
    registryAddress: string;
    privateKey: string;
    defaultResolver: string;
    caching?: {
        enabled: boolean;
        ttl: number;
    };
}
export interface SchemaVersion {
    major: number;
    minor: number;
    patch: number;
}
export interface SchemaValidationResult {
    valid: boolean;
    schema: AttestationSchema;
    version: SchemaVersion;
    errors: string[];
    warnings: string[];
}
export interface SchemaCompatibility {
    compatible: boolean;
    changes: {
        added: string[];
        removed: string[];
        modified: string[];
    };
    breaking: boolean;
}
//# sourceMappingURL=attestation.d.ts.map
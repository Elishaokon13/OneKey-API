export interface OneKeyConfig {
    apiKey?: string;
    environment: 'production' | 'sandbox';
    baseUrl?: string;
    timeout?: number;
    retryAttempts?: number;
    headers?: Record<string, string>;
    debug?: boolean;
    retry?: {
        attempts: number;
        delay: number;
        backoff: 'linear' | 'exponential';
    };
}
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: Record<string, any>;
    };
    requestId: string;
    timestamp: string;
}
export type KycProvider = 'smile_identity' | 'onfido' | 'trulioo';
export type KycStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
export type DocumentType = 'passport' | 'national_id' | 'drivers_license';
export interface KycUser {
    email: string;
    firstName?: string;
    lastName?: string;
    country?: string;
}
export interface CreateKycSessionRequest {
    user: KycUser;
    documentType: DocumentType;
    country: string;
    provider?: KycProvider;
    callbackUrl?: string;
}
export interface KycSession {
    sessionId: string;
    status: KycStatus;
    provider: KycProvider;
    user: KycUser;
    integration: {
        verificationUrl: string;
        sdkToken: string;
    };
    timestamps: {
        createdAt: string;
        expiresAt: string;
    };
}
export interface KycDocument {
    documentId: string;
    sessionId: string;
    documentType: DocumentType;
    filename?: string;
    mimeType?: string;
    side?: 'front' | 'back';
    status: 'uploaded' | 'processing' | 'processed' | 'failed';
    metadata?: Record<string, any>;
    uploadedAt: string;
    processedAt?: string;
}
export interface KycWebhookEvent {
    event: 'session.created' | 'session.updated' | 'session.completed' | 'session.failed' | 'document.uploaded' | 'document.processed' | 'verification.completed';
    data: any;
    timestamp: string;
    signature?: string;
}
export interface Attestation {
    id: string;
    uid: string;
    recipient: string;
    transactionHash: string;
    status: 'confirmed' | 'pending' | 'failed';
    createdAt: string;
}
export interface AttestationSchema {
    id: string;
    name: string;
    description?: string;
    schema: string;
    resolver?: string;
    revocable: boolean;
    createdAt: string;
}
export interface AttestationRecord {
    id: string;
    uid: string;
    schemaId: string;
    recipient: string;
    attester: string;
    data: Record<string, any>;
    revocable: boolean;
    revoked: boolean;
    revokedAt?: string;
    expirationTime?: number;
    transactionHash?: string;
    blockNumber?: number;
    createdAt: string;
    metadata?: Record<string, any>;
}
export interface CryptoProvider {
    id: string;
    name: string;
    type: 'symmetric' | 'asymmetric';
    algorithms: string[];
    keySize: number;
    enabled: boolean;
}
export declare class OneKeyError extends Error {
    code: string;
    details?: Record<string, any> | undefined;
    constructor(code: string, message: string, details?: Record<string, any> | undefined);
}
export declare class ApiError extends OneKeyError {
    status: number;
    constructor(message: string, status: number, code: string, details?: Record<string, any>);
}
export declare class NetworkError extends OneKeyError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class AuthenticationError extends OneKeyError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class ValidationError extends OneKeyError {
    constructor(message: string, details?: Record<string, any>);
}
//# sourceMappingURL=index.d.ts.map
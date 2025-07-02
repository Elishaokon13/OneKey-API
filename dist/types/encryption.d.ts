/**
 * OneKey KYC API - Encryption Types
 *
 * Defines types for client-side encryption utilities and key management.
 * Supports AES-256-GCM encryption with secure key derivation.
 */
export interface EncryptionRequest {
    data: string | Buffer;
    password?: string;
    keyId?: string;
    metadata?: Record<string, any>;
}
export interface EncryptionResponse {
    encryptedData: string;
    iv: string;
    salt: string;
    authTag: string;
    algorithm: string;
    keyId?: string;
    metadata?: EncryptionMetadata;
}
export interface DecryptionRequest {
    encryptedData: string;
    iv: string;
    salt: string;
    authTag: string;
    password?: string;
    keyId?: string;
    algorithm: string;
}
export interface DecryptionResponse {
    data: string | Buffer;
    metadata?: EncryptionMetadata;
    verified: boolean;
}
export interface EncryptionMetadata {
    timestamp: number;
    userId?: string;
    kycSessionId?: string;
    dataType: 'kyc_document' | 'kyc_result' | 'attestation_data' | 'user_profile' | 'generic';
    version: string;
    checksum?: string;
}
export interface EncryptionKey {
    keyId: string;
    algorithm: string;
    keyData: string;
    salt: string;
    iterations: number;
    createdAt: number;
    expiresAt?: number;
    usage: KeyUsage[];
    metadata?: Record<string, any>;
}
export interface KeyDerivationConfig {
    algorithm: 'pbkdf2' | 'scrypt' | 'argon2';
    iterations: number;
    saltLength: number;
    keyLength: number;
    hashFunction?: 'sha256' | 'sha512';
}
export interface KeyGenerationRequest {
    password?: string;
    keyId?: string;
    usage: KeyUsage[];
    expiresIn?: number;
    derivationConfig?: KeyDerivationConfig;
    metadata?: Record<string, any>;
}
export interface KeyGenerationResponse {
    keyId: string;
    publicKey?: string;
    salt: string;
    derivationConfig: KeyDerivationConfig;
    expiresAt?: number;
}
export type KeyUsage = 'encrypt' | 'decrypt' | 'sign' | 'verify' | 'key_derivation' | 'kyc_data' | 'attestation_data';
export interface EncryptionConfig {
    defaultAlgorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
    keyDerivation: KeyDerivationConfig;
    keyRotationInterval: number;
    maxKeyAge: number;
    compressionEnabled: boolean;
    integrityCheckEnabled: boolean;
}
export interface ClientEncryptionConfig {
    serverPublicKey?: string;
    encryptionEndpoint: string;
    decryptionEndpoint: string;
    keyManagementEndpoint: string;
    algorithm: string;
    maxFileSize: number;
}
export interface EncryptionService {
    encrypt(request: EncryptionRequest): Promise<EncryptionResponse>;
    decrypt(request: DecryptionRequest): Promise<DecryptionResponse>;
    generateKey(request: KeyGenerationRequest): Promise<KeyGenerationResponse>;
    rotateKey(keyId: string): Promise<KeyGenerationResponse>;
    deriveKey(password: string, salt: string, config: KeyDerivationConfig): Promise<string>;
    validateIntegrity(data: string, checksum: string): boolean;
}
export interface FileEncryptionRequest {
    file: Buffer | string;
    filename: string;
    mimeType?: string;
    password?: string;
    keyId?: string;
    compressBeforeEncryption?: boolean;
}
export interface FileEncryptionResponse {
    encryptedFile: string;
    filename: string;
    originalSize: number;
    encryptedSize: number;
    compressionRatio?: number;
    encryption: EncryptionResponse;
}
export interface FileDecryptionRequest {
    encryptedFile: string;
    encryption: DecryptionRequest;
    outputPath?: string;
}
export interface FileDecryptionResponse {
    file: Buffer;
    filename: string;
    mimeType?: string;
    originalSize: number;
    verified: boolean;
}
export interface BatchEncryptionRequest {
    items: Array<{
        id: string;
        data: EncryptionRequest;
    }>;
    useSharedKey?: boolean;
    keyId?: string;
}
export interface BatchEncryptionResponse {
    results: Array<{
        id: string;
        success: boolean;
        data?: EncryptionResponse;
        error?: string;
    }>;
    sharedKeyId?: string;
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
}
export interface KycDataEncryption {
    kycSessionId: string;
    userId: string;
    documents: FileEncryptionResponse[];
    verificationResults: EncryptionResponse;
    biometricData?: EncryptionResponse;
    metadata: EncryptionResponse;
    encryptionKeyId: string;
    createdAt: number;
}
export interface AttestationDataEncryption {
    attestationId: string;
    userId: string;
    kycSessionId: string;
    encryptedProofs: EncryptionResponse;
    storageReferences: StorageReference[];
    encryptionKeyId: string;
    createdAt: number;
}
export interface StorageReference {
    storageProvider: 'filecoin' | 'arweave' | 'ipfs';
    storageId: string;
    encryptionMetadata: EncryptionMetadata;
    accessUrl?: string;
    checksum: string;
}
export declare class EncryptionError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class DecryptionError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class KeyManagementError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export declare class IntegrityError extends Error {
    code: string;
    details?: any | undefined;
    constructor(message: string, code: string, details?: any | undefined);
}
export interface EncryptionApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    requestId: string;
    timestamp: number;
}
export interface EncryptionHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    algorithm: string;
    keyRotationStatus: 'active' | 'pending' | 'failed';
    lastKeyRotation?: number;
    activeKeys: number;
    expiredKeys: number;
    encryptionLatency: number;
    decryptionLatency: number;
    errorRate: number;
    uptime: number;
}
export type EncryptionAlgorithm = 'aes-256-gcm' | 'aes-256-cbc' | 'aes-192-gcm' | 'chacha20-poly1305';
export type KeyDerivationAlgorithm = 'pbkdf2' | 'scrypt' | 'argon2';
export type CompressionAlgorithm = 'gzip' | 'deflate' | 'brotli' | 'none';
export interface EncryptionStats {
    totalEncryptions: number;
    totalDecryptions: number;
    totalKeys: number;
    averageEncryptionTime: number;
    averageDecryptionTime: number;
    encryptionSuccessRate: number;
    decryptionSuccessRate: number;
    dataVolumeEncrypted: number;
    dataVolumeDecrypted: number;
}
//# sourceMappingURL=encryption.d.ts.map
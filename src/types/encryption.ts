/**
 * OneKey KYC API - Encryption Types
 * 
 * Defines types for client-side encryption utilities and key management.
 * Supports AES-256-GCM encryption with secure key derivation.
 */

// ===== Core Encryption Types =====

export interface EncryptionRequest {
  data: string | Buffer;
  password?: string;
  keyId?: string;
  metadata?: Record<string, any>;
}

export interface EncryptionResponse {
  encryptedData: string; // Base64 encoded
  iv: string; // Base64 encoded initialization vector
  salt: string; // Base64 encoded salt for key derivation
  authTag: string; // Base64 encoded authentication tag
  algorithm: string; // Encryption algorithm used
  keyId?: string; // Reference to encryption key
  metadata?: EncryptionMetadata;
}

export interface DecryptionRequest {
  encryptedData: string; // Base64 encoded
  iv: string; // Base64 encoded
  salt: string; // Base64 encoded
  authTag: string; // Base64 encoded
  password?: string;
  keyId?: string;
  algorithm: string;
}

export interface DecryptionResponse {
  data: string | Buffer;
  metadata?: EncryptionMetadata;
  verified: boolean; // Authentication tag verification result
}

export interface EncryptionMetadata {
  timestamp: number;
  userId?: string;
  kycSessionId?: string;
  dataType: 'kyc_document' | 'kyc_result' | 'attestation_data' | 'user_profile' | 'generic';
  version: string;
  checksum?: string;
}

// ===== Key Management Types =====

export interface EncryptionKey {
  keyId: string;
  algorithm: string;
  keyData: string; // Base64 encoded key
  salt: string; // Base64 encoded salt
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
  expiresIn?: number; // Seconds
  derivationConfig?: KeyDerivationConfig;
  metadata?: Record<string, any>;
}

export interface KeyGenerationResponse {
  keyId: string;
  publicKey?: string; // For asymmetric encryption
  salt: string;
  derivationConfig: KeyDerivationConfig;
  expiresAt?: number;
}

export type KeyUsage = 
  | 'encrypt' 
  | 'decrypt' 
  | 'sign' 
  | 'verify' 
  | 'key_derivation' 
  | 'kyc_data' 
  | 'attestation_data';

// ===== Configuration Types =====

export interface EncryptionConfig {
  defaultAlgorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
  keyDerivation: KeyDerivationConfig;
  keyRotationInterval: number; // Hours
  maxKeyAge: number; // Hours
  compressionEnabled: boolean;
  integrityCheckEnabled: boolean;
}

export interface ClientEncryptionConfig {
  serverPublicKey?: string;
  encryptionEndpoint: string;
  decryptionEndpoint: string;
  keyManagementEndpoint: string;
  algorithm: string;
  maxFileSize: number; // Bytes
}

// ===== Encryption Service Types =====

export interface EncryptionService {
  encrypt(request: EncryptionRequest): Promise<EncryptionResponse>;
  decrypt(request: DecryptionRequest): Promise<DecryptionResponse>;
  generateKey(request: KeyGenerationRequest): Promise<KeyGenerationResponse>;
  rotateKey(keyId: string): Promise<KeyGenerationResponse>;
  deriveKey(password: string, salt: string, config: KeyDerivationConfig): Promise<string>;
  validateIntegrity(data: string, checksum: string): boolean;
}

// ===== File Encryption Types =====

export interface FileEncryptionRequest {
  file: Buffer | string; // File content or path
  filename: string;
  mimeType?: string;
  password?: string;
  keyId?: string;
  compressBeforeEncryption?: boolean;
}

export interface FileEncryptionResponse {
  encryptedFile: string; // Base64 encoded
  filename: string;
  originalSize: number;
  encryptedSize: number;
  compressionRatio?: number;
  encryption: EncryptionResponse;
}

export interface FileDecryptionRequest {
  encryptedFile: string; // Base64 encoded
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

// ===== Batch Operations =====

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

// ===== Integration Types =====

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

// ===== Error Types =====

export class EncryptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class KeyManagementError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'KeyManagementError';
  }
}

export class IntegrityError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IntegrityError';
  }
}

// ===== API Response Types =====

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
  encryptionLatency: number; // ms
  decryptionLatency: number; // ms
  errorRate: number; // percentage
  uptime: number; // seconds
}

// ===== Utility Types =====

export type EncryptionAlgorithm = 
  | 'aes-256-gcm' 
  | 'aes-256-cbc' 
  | 'aes-192-gcm' 
  | 'chacha20-poly1305';

export type KeyDerivationAlgorithm = 
  | 'pbkdf2' 
  | 'scrypt' 
  | 'argon2';

export type CompressionAlgorithm = 
  | 'gzip' 
  | 'deflate' 
  | 'brotli' 
  | 'none';

export interface EncryptionStats {
  totalEncryptions: number;
  totalDecryptions: number;
  totalKeys: number;
  averageEncryptionTime: number; // ms
  averageDecryptionTime: number; // ms
  encryptionSuccessRate: number; // percentage
  decryptionSuccessRate: number; // percentage
  dataVolumeEncrypted: number; // bytes
  dataVolumeDecrypted: number; // bytes
} 
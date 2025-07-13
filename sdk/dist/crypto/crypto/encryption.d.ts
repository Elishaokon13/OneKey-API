export interface EncryptionOptions {
    algorithm?: 'AES-256-GCM' | 'AES-256-CBC';
    keySize?: number;
    ivSize?: number;
    tagSize?: number;
    iterations?: number;
}
export interface EncryptionResult {
    encrypted: string;
    keyId: string;
    iv: string;
    tag?: string;
    algorithm: string;
    keySize: number;
    metadata?: Record<string, any>;
}
export interface DecryptionOptions {
    algorithm: string;
    keySize: number;
    iv: string;
    tag?: string;
}
export interface KeyPair {
    publicKey: string;
    privateKey: string;
    keyId: string;
    algorithm: string;
    created: Date;
}
export declare class EncryptionManager {
    private keys;
    private defaultOptions;
    constructor(options?: Partial<EncryptionOptions>);
    /**
     * Generate a new encryption key
     */
    generateKey(keyId?: string): string;
    /**
     * Import an existing key
     */
    importKey(keyId: string, keyData: string): void;
    /**
     * Export a key
     */
    exportKey(keyId: string): string;
    /**
     * Derive key from password using PBKDF2
     */
    deriveKeyFromPassword(password: string, salt?: string): {
        keyId: string;
        salt: string;
    };
    /**
     * Encrypt data using AES-256-GCM
     */
    encrypt(data: string | object, keyId: string, options?: Partial<EncryptionOptions>): EncryptionResult;
    /**
     * Decrypt data
     */
    decrypt(encryptedData: EncryptionResult, keyId: string): string;
    /**
     * Encrypt file data
     */
    encryptFile(file: File | Buffer, keyId: string, options?: Partial<EncryptionOptions>): Promise<EncryptionResult & {
        filename?: string;
        mimeType?: string;
    }>;
    /**
     * Decrypt file data
     */
    decryptFile(encryptedData: EncryptionResult & {
        filename?: string;
        mimeType?: string;
    }, keyId: string): Promise<{
        data: Buffer;
        filename?: string;
        mimeType?: string;
    }>;
    /**
     * Generate key pair for asymmetric encryption (using RSA)
     */
    generateKeyPair(): KeyPair;
    /**
     * Sign data using private key
     */
    sign(data: string | object, privateKey: string): string;
    /**
     * Verify signature using public key
     */
    verify(data: string | object, signature: string, publicKey: string): boolean;
    /**
     * Get key information
     */
    getKeyInfo(keyId: string): {
        exists: boolean;
        algorithm: string;
        keySize: number;
    };
    /**
     * List all available keys
     */
    listKeys(): string[];
    /**
     * Remove a key
     */
    removeKey(keyId: string): boolean;
    /**
     * Clear all keys
     */
    clearKeys(): void;
    /**
     * Generate secure random bytes
     */
    generateRandomBytes(size: number): string;
    /**
     * Hash data using SHA-256
     */
    hash(data: string | object): string;
    /**
     * Private helper methods
     */
    private encryptGCM;
    private encryptCBC;
    private decryptGCM;
    private decryptCBC;
    private generateKeyId;
    private fileToBase64;
}
export declare function createEncryptionManager(options?: Partial<EncryptionOptions>): EncryptionManager;
export declare function generateSecurePassword(length?: number): string;
export declare function validateEncryptionKey(keyData: string): boolean;
//# sourceMappingURL=encryption.d.ts.map
import { EncryptionResult, EncryptionOptions } from './encryption';
import { OneKeyConfig, CryptoProvider } from '../types';
import { EventEmitter } from 'events';
export declare class CryptoClient extends EventEmitter {
    private httpClient;
    private encryptionManager;
    private config;
    constructor(config: OneKeyConfig);
    /**
     * Get available crypto providers from the server
     */
    getProviders(): Promise<CryptoProvider[]>;
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
     * Derive key from password
     */
    deriveKeyFromPassword(password: string, salt?: string): {
        keyId: string;
        salt: string;
    };
    /**
     * Encrypt data locally
     */
    encryptLocal(data: string | object, keyId: string, options?: Partial<EncryptionOptions>): EncryptionResult;
    /**
     * Decrypt data locally
     */
    decryptLocal(encryptedData: EncryptionResult, keyId: string): string;
    /**
     * Encrypt data using server-side encryption
     */
    encryptRemote(data: string | object, options?: {
        provider?: string;
        keyId?: string;
        algorithm?: string;
        metadata?: Record<string, any>;
    }): Promise<{
        encrypted: string;
        keyId: string;
        algorithm: string;
        metadata?: Record<string, any>;
    }>;
    /**
     * Decrypt data using server-side decryption
     */
    decryptRemote(encryptedData: string, keyId: string, options?: {
        algorithm?: string;
        metadata?: Record<string, any>;
    }): Promise<string>;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<OneKeyConfig>): void;
    /**
     * Cleanup method
     */
    destroy(): void;
}
export declare function createCryptoClient(config: OneKeyConfig): CryptoClient;
//# sourceMappingURL=crypto-client.d.ts.map
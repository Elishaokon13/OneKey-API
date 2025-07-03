/**
 * OneKey KYC API - Encryption Service
 *
 * Implements client-side encryption utilities with AES-256-GCM encryption,
 * PBKDF2 key derivation, and secure key management.
 */
import { EncryptionRequest, EncryptionResponse, DecryptionRequest, DecryptionResponse, EncryptionService as IEncryptionService, KeyGenerationRequest, KeyGenerationResponse, KeyDerivationConfig, EncryptionConfig } from '../../types/encryption';
export declare class EncryptionService implements IEncryptionService {
    private keys;
    private config;
    private startTime;
    private stats;
    constructor(config?: Partial<EncryptionConfig>);
    encrypt(request: EncryptionRequest): Promise<EncryptionResponse>;
    decrypt(request: DecryptionRequest): Promise<DecryptionResponse>;
    generateKey(request: KeyGenerationRequest): Promise<KeyGenerationResponse>;
    rotateKey(keyId: string): Promise<KeyGenerationResponse>;
    deriveKey(password: string, salt: string, config: KeyDerivationConfig): Promise<string>;
    validateIntegrity(data: string, checksum: string): boolean;
    private generateChecksum;
    private generateKeyId;
    getHealthStatus(): {
        status: string;
        algorithm: "aes-256-gcm" | "aes-256-cbc" | "chacha20-poly1305";
        keyRotationStatus: string;
        activeKeys: number;
        expiredKeys: number;
        encryptionLatency: number;
        decryptionLatency: number;
        errorRate: number;
        uptime: number;
    };
}
export declare const encryptionService: EncryptionService;
//# sourceMappingURL=encryptionService.d.ts.map
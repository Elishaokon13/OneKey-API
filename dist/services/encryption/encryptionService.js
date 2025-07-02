"use strict";
/**
 * OneKey KYC API - Encryption Service
 *
 * Implements client-side encryption utilities with AES-256-GCM encryption,
 * PBKDF2 key derivation, and secure key management.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = exports.EncryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const util_1 = require("util");
const zlib_1 = __importDefault(require("zlib"));
const encryption_1 = require("@/types/encryption");
const logger_1 = require("@/utils/logger");
// Promisify compression functions
const gzip = (0, util_1.promisify)(zlib_1.default.gzip);
const gunzip = (0, util_1.promisify)(zlib_1.default.gunzip);
class EncryptionService {
    keys = new Map();
    config;
    startTime = Date.now();
    stats = {
        totalEncryptions: 0,
        totalDecryptions: 0,
        encryptionTimes: [],
        decryptionTimes: [],
        errors: 0
    };
    constructor(config) {
        this.config = {
            defaultAlgorithm: 'aes-256-gcm',
            keyDerivation: {
                algorithm: 'pbkdf2',
                iterations: 100000,
                saltLength: 32,
                keyLength: 32,
                hashFunction: 'sha256'
            },
            keyRotationInterval: 24,
            maxKeyAge: 168,
            compressionEnabled: true,
            integrityCheckEnabled: true,
            ...config
        };
        logger_1.logger.info('EncryptionService initialized', {
            algorithm: this.config.defaultAlgorithm,
            keyDerivation: this.config.keyDerivation.algorithm
        });
    }
    async encrypt(request) {
        const startTime = Date.now();
        try {
            const algorithm = this.config.defaultAlgorithm;
            // Generate or retrieve encryption key
            let encryptionKey;
            let keyId;
            let salt;
            if (request.keyId) {
                const key = this.keys.get(request.keyId);
                if (!key) {
                    throw new encryption_1.EncryptionError('Key not found', 'KEY_NOT_FOUND', { keyId: request.keyId });
                }
                encryptionKey = key.keyData;
                keyId = request.keyId;
                salt = key.salt;
            }
            else if (request.password) {
                salt = crypto_1.default.randomBytes(this.config.keyDerivation.saltLength).toString('base64');
                encryptionKey = await this.deriveKey(request.password, salt, this.config.keyDerivation);
            }
            else {
                throw new encryption_1.EncryptionError('Either keyId or password must be provided', 'MISSING_KEY_OR_PASSWORD');
            }
            // Prepare data for encryption
            let dataToEncrypt;
            if (typeof request.data === 'string') {
                dataToEncrypt = Buffer.from(request.data, 'utf8');
            }
            else {
                dataToEncrypt = request.data;
            }
            // Compress data if enabled
            if (this.config.compressionEnabled) {
                dataToEncrypt = await gzip(dataToEncrypt);
            }
            // Generate IV and encrypt
            const iv = crypto_1.default.randomBytes(16);
            const cipher = crypto_1.default.createCipher('aes-256-gcm', Buffer.from(encryptionKey, 'base64'));
            const encrypted = Buffer.concat([
                cipher.update(dataToEncrypt),
                cipher.final()
            ]);
            const authTag = cipher.getAuthTag().toString('base64');
            // Create metadata
            const metadata = {
                timestamp: Date.now(),
                dataType: request.metadata?.dataType || 'generic',
                version: '1.0.0',
                checksum: this.generateChecksum(dataToEncrypt),
                ...request.metadata
            };
            const response = {
                encryptedData: encrypted.toString('base64'),
                iv: iv.toString('base64'),
                salt,
                authTag,
                algorithm,
                keyId,
                metadata
            };
            this.stats.totalEncryptions++;
            this.stats.encryptionTimes.push(Date.now() - startTime);
            return response;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Encryption failed', { error: error.message });
            if (error instanceof encryption_1.EncryptionError) {
                throw error;
            }
            throw new encryption_1.EncryptionError('Encryption failed', 'ENCRYPTION_FAILED', { originalError: error.message });
        }
    }
    async decrypt(request) {
        const startTime = Date.now();
        try {
            // Generate or retrieve decryption key
            let decryptionKey;
            if (request.keyId) {
                const key = this.keys.get(request.keyId);
                if (!key) {
                    throw new encryption_1.DecryptionError('Key not found', 'KEY_NOT_FOUND', { keyId: request.keyId });
                }
                decryptionKey = key.keyData;
            }
            else if (request.password) {
                decryptionKey = await this.deriveKey(request.password, request.salt, this.config.keyDerivation);
            }
            else {
                throw new encryption_1.DecryptionError('Either keyId or password must be provided', 'MISSING_KEY_OR_PASSWORD');
            }
            // Decrypt data
            const iv = Buffer.from(request.iv, 'base64');
            const encrypted = Buffer.from(request.encryptedData, 'base64');
            const authTag = Buffer.from(request.authTag, 'base64');
            const decipher = crypto_1.default.createDecipher('aes-256-gcm', Buffer.from(decryptionKey, 'base64'));
            decipher.setAuthTag(authTag);
            let decrypted;
            try {
                decrypted = Buffer.concat([
                    decipher.update(encrypted),
                    decipher.final()
                ]);
            }
            catch (error) {
                throw new encryption_1.DecryptionError('Authentication failed or corrupted data', 'AUTH_FAILED');
            }
            // Decompress if needed
            if (this.config.compressionEnabled) {
                try {
                    decrypted = await gunzip(decrypted);
                }
                catch (error) {
                    // Data might not be compressed
                    logger_1.logger.warn('Decompression failed, assuming uncompressed data');
                }
            }
            this.stats.totalDecryptions++;
            this.stats.decryptionTimes.push(Date.now() - startTime);
            return {
                data: decrypted,
                verified: true
            };
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Decryption failed', { error: error.message });
            if (error instanceof encryption_1.DecryptionError) {
                throw error;
            }
            throw new encryption_1.DecryptionError('Decryption failed', 'DECRYPTION_FAILED', { originalError: error.message });
        }
    }
    async generateKey(request) {
        try {
            const keyId = request.keyId || this.generateKeyId();
            const derivationConfig = request.derivationConfig || this.config.keyDerivation;
            const salt = crypto_1.default.randomBytes(derivationConfig.saltLength).toString('base64');
            let keyData;
            if (request.password) {
                keyData = await this.deriveKey(request.password, salt, derivationConfig);
            }
            else {
                const randomKey = crypto_1.default.randomBytes(derivationConfig.keyLength);
                keyData = randomKey.toString('base64');
            }
            const expiresAt = request.expiresIn ? Date.now() + (request.expiresIn * 1000) : undefined;
            const key = {
                keyId,
                algorithm: this.config.defaultAlgorithm,
                keyData,
                salt,
                iterations: derivationConfig.iterations,
                createdAt: Date.now(),
                expiresAt,
                usage: request.usage,
                metadata: request.metadata
            };
            this.keys.set(keyId, key);
            return {
                keyId,
                salt,
                derivationConfig,
                expiresAt
            };
        }
        catch (error) {
            throw new encryption_1.KeyManagementError('Key generation failed', 'KEY_GENERATION_FAILED', { originalError: error.message });
        }
    }
    async rotateKey(keyId) {
        const existingKey = this.keys.get(keyId);
        if (!existingKey) {
            throw new encryption_1.KeyManagementError('Key not found for rotation', 'KEY_NOT_FOUND', { keyId });
        }
        const newKeyRequest = {
            keyId: this.generateKeyId(),
            usage: existingKey.usage,
            derivationConfig: {
                algorithm: 'pbkdf2',
                iterations: existingKey.iterations,
                saltLength: 32,
                keyLength: 32,
                hashFunction: 'sha256'
            },
            metadata: existingKey.metadata
        };
        const newKey = await this.generateKey(newKeyRequest);
        existingKey.expiresAt = Date.now();
        this.keys.set(keyId, existingKey);
        return newKey;
    }
    async deriveKey(password, salt, config) {
        try {
            const saltBuffer = Buffer.from(salt, 'base64');
            let key;
            switch (config.algorithm) {
                case 'pbkdf2':
                    key = crypto_1.default.pbkdf2Sync(password, saltBuffer, config.iterations, config.keyLength, config.hashFunction || 'sha256');
                    break;
                case 'scrypt':
                    key = crypto_1.default.scryptSync(password, saltBuffer, config.keyLength, {
                        N: config.iterations,
                        r: 8,
                        p: 1
                    });
                    break;
                default:
                    throw new encryption_1.KeyManagementError('Unsupported key derivation algorithm', 'UNSUPPORTED_ALGORITHM');
            }
            return key.toString('base64');
        }
        catch (error) {
            throw new encryption_1.KeyManagementError('Key derivation failed', 'KEY_DERIVATION_FAILED', { originalError: error.message });
        }
    }
    validateIntegrity(data, checksum) {
        try {
            const calculatedChecksum = this.generateChecksum(Buffer.from(data));
            return calculatedChecksum === checksum;
        }
        catch (error) {
            return false;
        }
    }
    generateChecksum(data) {
        return crypto_1.default.createHash('sha256').update(data).digest('hex');
    }
    generateKeyId() {
        return `key_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
    }
    getHealthStatus() {
        const uptime = (Date.now() - this.startTime) / 1000;
        const avgEncryptionTime = this.stats.encryptionTimes.length > 0
            ? this.stats.encryptionTimes.reduce((a, b) => a + b, 0) / this.stats.encryptionTimes.length
            : 0;
        const avgDecryptionTime = this.stats.decryptionTimes.length > 0
            ? this.stats.decryptionTimes.reduce((a, b) => a + b, 0) / this.stats.decryptionTimes.length
            : 0;
        const totalOperations = this.stats.totalEncryptions + this.stats.totalDecryptions;
        const errorRate = totalOperations > 0 ? (this.stats.errors / totalOperations) * 100 : 0;
        const activeKeys = Array.from(this.keys.values()).filter(key => !key.expiresAt || key.expiresAt > Date.now()).length;
        const expiredKeys = this.keys.size - activeKeys;
        return {
            status: errorRate < 5 ? 'healthy' : errorRate < 15 ? 'degraded' : 'unhealthy',
            algorithm: this.config.defaultAlgorithm,
            keyRotationStatus: 'active',
            activeKeys,
            expiredKeys,
            encryptionLatency: Math.round(avgEncryptionTime),
            decryptionLatency: Math.round(avgDecryptionTime),
            errorRate: Math.round(errorRate * 100) / 100,
            uptime: Math.round(uptime)
        };
    }
}
exports.EncryptionService = EncryptionService;
exports.encryptionService = new EncryptionService();
//# sourceMappingURL=encryptionService.js.map
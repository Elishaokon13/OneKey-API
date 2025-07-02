/**
 * OneKey KYC API - Encryption Service
 * 
 * Implements client-side encryption utilities with AES-256-GCM encryption,
 * PBKDF2 key derivation, and secure key management.
 */

import crypto from 'crypto';
import { promisify } from 'util';
import zlib from 'zlib';
import { 
  EncryptionRequest, 
  EncryptionResponse, 
  DecryptionRequest, 
  DecryptionResponse,
  EncryptionService as IEncryptionService,
  KeyGenerationRequest,
  KeyGenerationResponse,
  KeyDerivationConfig,
  EncryptionConfig,
  FileEncryptionRequest,
  FileEncryptionResponse,
  BatchEncryptionRequest,
  BatchEncryptionResponse,
  EncryptionKey,
  EncryptionMetadata,
  EncryptionError,
  DecryptionError,
  KeyManagementError
} from '@/types/encryption';
import { logger } from '@/utils/logger';

// Promisify compression functions
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export class EncryptionService implements IEncryptionService {
  private keys: Map<string, EncryptionKey> = new Map();
  private config: EncryptionConfig;
  private startTime: number = Date.now();
  private stats = {
    totalEncryptions: 0,
    totalDecryptions: 0,
    encryptionTimes: [] as number[],
    decryptionTimes: [] as number[],
    errors: 0
  };

  constructor(config?: Partial<EncryptionConfig>) {
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

    logger.info('EncryptionService initialized', {
      algorithm: this.config.defaultAlgorithm,
      keyDerivation: this.config.keyDerivation.algorithm
    });
  }

  async encrypt(request: EncryptionRequest): Promise<EncryptionResponse> {
    const startTime = Date.now();
    
    try {
      const algorithm = this.config.defaultAlgorithm;
      
      // Generate or retrieve encryption key
      let encryptionKey: string;
      let keyId: string | undefined;
      let salt: string;

      if (request.keyId) {
        const key = this.keys.get(request.keyId);
        if (!key) {
          throw new EncryptionError('Key not found', 'KEY_NOT_FOUND', { keyId: request.keyId });
        }
        encryptionKey = key.keyData;
        keyId = request.keyId;
        salt = key.salt;
      } else if (request.password) {
        salt = crypto.randomBytes(this.config.keyDerivation.saltLength).toString('base64');
        encryptionKey = await this.deriveKey(request.password, salt, this.config.keyDerivation);
      } else {
        throw new EncryptionError('Either keyId or password must be provided', 'MISSING_KEY_OR_PASSWORD');
      }

      // Prepare data for encryption
      let dataToEncrypt: Buffer;
      if (typeof request.data === 'string') {
        dataToEncrypt = Buffer.from(request.data, 'utf8');
      } else {
        dataToEncrypt = request.data;
      }

      // Compress data if enabled
      if (this.config.compressionEnabled) {
        dataToEncrypt = await gzip(dataToEncrypt);
      }

      // Generate IV and encrypt
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey, 'base64'), iv);
      
      const encrypted = Buffer.concat([
        cipher.update(dataToEncrypt),
        cipher.final()
      ]);

      const authTag = (cipher as any).getAuthTag().toString('base64');

      // Create metadata
      const metadata: EncryptionMetadata = {
        timestamp: Date.now(),
        dataType: request.metadata?.dataType || 'generic',
        version: '1.0.0',
        checksum: this.generateChecksum(dataToEncrypt),
        ...request.metadata
      };

      const response: EncryptionResponse = {
        encryptedData: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        salt,
        authTag,
        algorithm,
        ...(keyId && { keyId }),
        metadata
      };

      this.stats.totalEncryptions++;
      this.stats.encryptionTimes.push(Date.now() - startTime);

      return response;

    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Encryption failed', { error: errorMessage });
      
      if (error instanceof EncryptionError) {
        throw error;
      }
      throw new EncryptionError('Encryption failed', 'ENCRYPTION_FAILED', { originalError: errorMessage });
    }
  }

  async decrypt(request: DecryptionRequest): Promise<DecryptionResponse> {
    const startTime = Date.now();

    try {
      // Generate or retrieve decryption key
      let decryptionKey: string;

      if (request.keyId) {
        const key = this.keys.get(request.keyId);
        if (!key) {
          throw new DecryptionError('Key not found', 'KEY_NOT_FOUND', { keyId: request.keyId });
        }
        decryptionKey = key.keyData;
      } else if (request.password) {
        decryptionKey = await this.deriveKey(request.password, request.salt, this.config.keyDerivation);
      } else {
        throw new DecryptionError('Either keyId or password must be provided', 'MISSING_KEY_OR_PASSWORD');
      }

      // Decrypt data
      const iv = Buffer.from(request.iv, 'base64');
      const encrypted = Buffer.from(request.encryptedData, 'base64');
      const authTag = Buffer.from(request.authTag, 'base64');

      const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(decryptionKey, 'base64'), iv);
      (decipher as any).setAuthTag(authTag);

      let decrypted: Buffer;
      try {
        decrypted = Buffer.concat([
          decipher.update(encrypted),
          decipher.final()
        ]);
      } catch (error) {
        throw new DecryptionError('Authentication failed or corrupted data', 'AUTH_FAILED');
      }

      // Decompress if needed
      if (this.config.compressionEnabled) {
        try {
          decrypted = await gunzip(decrypted);
        } catch (error) {
          // Data might not be compressed
          logger.warn('Decompression failed, assuming uncompressed data');
        }
      }

      this.stats.totalDecryptions++;
      this.stats.decryptionTimes.push(Date.now() - startTime);

      return {
        data: decrypted,
        verified: true
      };

    } catch (error) {
      this.stats.errors++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Decryption failed', { error: errorMessage });
      
      if (error instanceof DecryptionError) {
        throw error;
      }
      throw new DecryptionError('Decryption failed', 'DECRYPTION_FAILED', { originalError: errorMessage });
    }
  }

  async generateKey(request: KeyGenerationRequest): Promise<KeyGenerationResponse> {
    try {
      const keyId = request.keyId || this.generateKeyId();
      const derivationConfig = request.derivationConfig || this.config.keyDerivation;
      
      const salt = crypto.randomBytes(derivationConfig.saltLength).toString('base64');
      
      let keyData: string;
      if (request.password) {
        keyData = await this.deriveKey(request.password, salt, derivationConfig);
      } else {
        const randomKey = crypto.randomBytes(derivationConfig.keyLength);
        keyData = randomKey.toString('base64');
      }

      const expiresAt = request.expiresIn ? Date.now() + (request.expiresIn * 1000) : undefined;

      const key: EncryptionKey = {
        keyId,
        algorithm: this.config.defaultAlgorithm,
        keyData,
        salt,
        iterations: derivationConfig.iterations,
        createdAt: Date.now(),
        ...(expiresAt && { expiresAt }),
        usage: request.usage,
        ...(request.metadata && { metadata: request.metadata })
      } as EncryptionKey;

      this.keys.set(keyId, key);

      const response: KeyGenerationResponse = {
        keyId,
        salt,
        derivationConfig,
        ...(expiresAt && { expiresAt })
      } as KeyGenerationResponse;

      return response;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new KeyManagementError('Key generation failed', 'KEY_GENERATION_FAILED', { originalError: errorMessage });
    }
  }

  async rotateKey(keyId: string): Promise<KeyGenerationResponse> {
    const existingKey = this.keys.get(keyId);
    if (!existingKey) {
      throw new KeyManagementError('Key not found for rotation', 'KEY_NOT_FOUND', { keyId });
    }

    const newKeyRequest: KeyGenerationRequest = {
      keyId: this.generateKeyId(),
      usage: existingKey.usage,
      derivationConfig: {
        algorithm: 'pbkdf2',
        iterations: existingKey.iterations,
        saltLength: 32,
        keyLength: 32,
        hashFunction: 'sha256'
      },
      ...(existingKey.metadata && { metadata: existingKey.metadata })
    };

    const newKey = await this.generateKey(newKeyRequest);
    
    existingKey.expiresAt = Date.now();
    this.keys.set(keyId, existingKey);

    return newKey;
  }

  async deriveKey(password: string, salt: string, config: KeyDerivationConfig): Promise<string> {
    try {
      const saltBuffer = Buffer.from(salt, 'base64');
      let key: Buffer;

      switch (config.algorithm) {
        case 'pbkdf2':
          key = crypto.pbkdf2Sync(password, saltBuffer, config.iterations, config.keyLength, config.hashFunction || 'sha256');
          break;
        case 'scrypt':
          key = crypto.scryptSync(password, saltBuffer, config.keyLength, {
            N: config.iterations,
            r: 8,
            p: 1
          });
          break;
        default:
          throw new KeyManagementError('Unsupported key derivation algorithm', 'UNSUPPORTED_ALGORITHM');
      }

      return key.toString('base64');

    } catch (error) {
      throw new KeyManagementError('Key derivation failed', 'KEY_DERIVATION_FAILED', { originalError: error.message });
    }
  }

  validateIntegrity(data: string, checksum: string): boolean {
    try {
      const calculatedChecksum = this.generateChecksum(Buffer.from(data));
      return calculatedChecksum === checksum;
    } catch (error) {
      return false;
    }
  }

  private generateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
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

export const encryptionService = new EncryptionService(); 
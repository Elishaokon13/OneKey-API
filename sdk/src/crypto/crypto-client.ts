import { HttpClient } from '../core/http-client';
import { EncryptionManager, EncryptionResult, EncryptionOptions, KeyPair } from './encryption';
import { OneKeyConfig, OneKeyError, CryptoProvider } from '../types';
import { EventEmitter } from 'events';

export class CryptoClient extends EventEmitter {
  private httpClient: HttpClient;
  private encryptionManager: EncryptionManager;
  private config: OneKeyConfig;

  constructor(config: OneKeyConfig) {
    super();
    this.config = config;
    this.httpClient = new HttpClient(config);
    this.encryptionManager = new EncryptionManager();
    
    // Forward HTTP client events
    this.httpClient.on('token:refreshed', (token) => {
      this.emit('token:refreshed', token);
    });
    
    this.httpClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Get available crypto providers from the server
   */
  async getProviders(): Promise<CryptoProvider[]> {
    try {
      const response = await this.httpClient.get<CryptoProvider[]>('/crypto/providers');
      if (!response.data) {
        throw new OneKeyError('CRYPTO_PROVIDERS_FETCH_FAILED', 'No data received from crypto providers endpoint');
      }
      return response.data;
    } catch (error) {
      throw new OneKeyError('CRYPTO_PROVIDERS_FETCH_FAILED', 'Failed to fetch crypto providers', error as any);
    }
  }

  /**
   * Generate a new encryption key
   */
  generateKey(keyId?: string): string {
    try {
      const id = this.encryptionManager.generateKey(keyId);
      this.emit('key:generated', { keyId: id });
      return id;
    } catch (error) {
      throw new OneKeyError('KEY_GENERATION_FAILED', 'Failed to generate encryption key', error as any);
    }
  }

  /**
   * Import an existing key
   */
  importKey(keyId: string, keyData: string): void {
    try {
      this.encryptionManager.importKey(keyId, keyData);
      this.emit('key:imported', { keyId });
    } catch (error) {
      throw new OneKeyError('KEY_IMPORT_FAILED', `Failed to import key ${keyId}`, error as any);
    }
  }

  /**
   * Export a key
   */
  exportKey(keyId: string): string {
    try {
      return this.encryptionManager.exportKey(keyId);
    } catch (error) {
      throw new OneKeyError('KEY_EXPORT_FAILED', `Failed to export key ${keyId}`, error as any);
    }
  }

  /**
   * Derive key from password
   */
  deriveKeyFromPassword(password: string, salt?: string): { keyId: string; salt: string } {
    try {
      const result = this.encryptionManager.deriveKeyFromPassword(password, salt);
      this.emit('key:derived', { keyId: result.keyId });
      return result;
    } catch (error) {
      throw new OneKeyError('KEY_DERIVATION_FAILED', 'Failed to derive key from password', error as any);
    }
  }

  /**
   * Encrypt data locally
   */
  encryptLocal(
    data: string | object,
    keyId: string,
    options?: Partial<EncryptionOptions>
  ): EncryptionResult {
    try {
      const result = this.encryptionManager.encrypt(data, keyId, options);
      this.emit('data:encrypted', { keyId, size: result.encrypted.length });
      return result;
    } catch (error) {
      throw new OneKeyError('LOCAL_ENCRYPTION_FAILED', 'Failed to encrypt data locally', error as any);
    }
  }

  /**
   * Decrypt data locally
   */
  decryptLocal(encryptedData: EncryptionResult, keyId: string): string {
    try {
      const result = this.encryptionManager.decrypt(encryptedData, keyId);
      this.emit('data:decrypted', { keyId });
      return result;
    } catch (error) {
      throw new OneKeyError('LOCAL_DECRYPTION_FAILED', 'Failed to decrypt data locally', error as any);
    }
  }

  /**
   * Encrypt data using server-side encryption
   */
  async encryptRemote(
    data: string | object,
    options: {
      provider?: string;
      keyId?: string;
      algorithm?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{
    encrypted: string;
    keyId: string;
    algorithm: string;
    metadata?: Record<string, any>;
  }> {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      
      const response = await this.httpClient.post<{
        encrypted: string;
        keyId: string;
        algorithm: string;
        metadata?: Record<string, any>;
      }>('/crypto/encrypt', {
        data: payload,
        ...options
      });
      
      if (!response.data) {
        throw new OneKeyError('REMOTE_ENCRYPTION_FAILED', 'No data received from encryption endpoint');
      }
      
      this.emit('data:encrypted:remote', { keyId: response.data.keyId });
      return response.data;
    } catch (error) {
      throw new OneKeyError('REMOTE_ENCRYPTION_FAILED', 'Failed to encrypt data remotely', error as any);
    }
  }

  /**
   * Decrypt data using server-side decryption
   */
  async decryptRemote(
    encryptedData: string,
    keyId: string,
    options: {
      algorithm?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    try {
      const response = await this.httpClient.post<{ decrypted: string }>('/crypto/decrypt', {
        encrypted: encryptedData,
        keyId,
        ...options
      });
      
      if (!response.data) {
        throw new OneKeyError('REMOTE_DECRYPTION_FAILED', 'No data received from decryption endpoint');
      }
      
      this.emit('data:decrypted:remote', { keyId });
      return response.data.decrypted;
    } catch (error) {
      throw new OneKeyError('REMOTE_DECRYPTION_FAILED', 'Failed to decrypt data remotely', error as any);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OneKeyConfig>): void {
    this.config = { ...this.config, ...config };
    this.httpClient.updateConfig(this.config);
    this.emit('config:updated', this.config);
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.encryptionManager.clearKeys();
    this.removeAllListeners();
  }
}

// Helper function to create crypto client
export function createCryptoClient(config: OneKeyConfig): CryptoClient {
  return new CryptoClient(config);
} 
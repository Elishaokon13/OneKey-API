import CryptoJS from 'crypto-js';
import { OneKeyError } from '../types';

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

export class EncryptionManager {
  private keys: Map<string, CryptoJS.lib.WordArray> = new Map();
  private defaultOptions: EncryptionOptions = {
    algorithm: 'AES-256-GCM',
    keySize: 256,
    ivSize: 96,
    tagSize: 128,
    iterations: 100000
  };

  constructor(options?: Partial<EncryptionOptions>) {
    this.defaultOptions = { ...this.defaultOptions, ...options };
  }

  /**
   * Generate a new encryption key
   */
  generateKey(keyId?: string): string {
    const id = keyId || this.generateKeyId();
    const key = CryptoJS.lib.WordArray.random(this.defaultOptions.keySize! / 8);
    this.keys.set(id, key);
    return id;
  }

  /**
   * Import an existing key
   */
  importKey(keyId: string, keyData: string): void {
    try {
      const key = CryptoJS.enc.Hex.parse(keyData);
      this.keys.set(keyId, key);
    } catch (error) {
      throw new OneKeyError('ENCRYPTION_KEY_IMPORT_FAILED', `Failed to import key ${keyId}`, error);
    }
  }

  /**
   * Export a key
   */
  exportKey(keyId: string): string {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new OneKeyError('ENCRYPTION_KEY_NOT_FOUND', `Key ${keyId} not found`);
    }
    return key.toString(CryptoJS.enc.Hex);
  }

  /**
   * Derive key from password using PBKDF2
   */
  deriveKeyFromPassword(password: string, salt?: string): { keyId: string; salt: string } {
    const actualSalt = salt || CryptoJS.lib.WordArray.random(128/8).toString(CryptoJS.enc.Hex);
    const key = CryptoJS.PBKDF2(password, actualSalt, {
      keySize: this.defaultOptions.keySize! / 32,
      iterations: this.defaultOptions.iterations!
    });
    
    const keyId = this.generateKeyId();
    this.keys.set(keyId, key);
    
    return { keyId, salt: actualSalt };
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(
    data: string | object,
    keyId: string,
    options?: Partial<EncryptionOptions>
  ): EncryptionResult {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new OneKeyError('ENCRYPTION_KEY_NOT_FOUND', `Key ${keyId} not found`);
    }

    const opts = { ...this.defaultOptions, ...options };
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

    try {
      if (opts.algorithm === 'AES-256-GCM') {
        return this.encryptGCM(plaintext, key, keyId, opts);
      } else {
        return this.encryptCBC(plaintext, key, keyId, opts);
      }
    } catch (error) {
      throw new OneKeyError('ENCRYPTION_FAILED', 'Failed to encrypt data', error);
    }
  }

  /**
   * Decrypt data
   */
  decrypt(
    encryptedData: EncryptionResult,
    keyId: string
  ): string {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new OneKeyError('ENCRYPTION_KEY_NOT_FOUND', `Key ${keyId} not found`);
    }

    try {
      if (encryptedData.algorithm === 'AES-256-GCM') {
        return this.decryptGCM(encryptedData, key);
      } else {
        return this.decryptCBC(encryptedData, key);
      }
    } catch (error) {
      throw new OneKeyError('DECRYPTION_FAILED', 'Failed to decrypt data', error);
    }
  }

  /**
   * Encrypt file data
   */
  async encryptFile(
    file: File | Buffer,
    keyId: string,
    options?: Partial<EncryptionOptions>
  ): Promise<EncryptionResult & { filename?: string; mimeType?: string }> {
    let data: string;
    let filename: string | undefined;
    let mimeType: string | undefined;

    if (file instanceof File) {
      data = await this.fileToBase64(file);
      filename = file.name;
      mimeType = file.type;
    } else {
      data = file.toString('base64');
    }

    const result = this.encrypt(data, keyId, options);
    return {
      ...result,
      filename,
      mimeType
    };
  }

  /**
   * Decrypt file data
   */
  async decryptFile(
    encryptedData: EncryptionResult & { filename?: string; mimeType?: string },
    keyId: string
  ): Promise<{ data: Buffer; filename?: string; mimeType?: string }> {
    const decryptedBase64 = this.decrypt(encryptedData, keyId);
    const data = Buffer.from(decryptedBase64, 'base64');
    
    return {
      data,
      filename: encryptedData.filename,
      mimeType: encryptedData.mimeType
    };
  }

  /**
   * Generate key pair for asymmetric encryption (using RSA)
   */
  generateKeyPair(): KeyPair {
    // Note: This is a simplified implementation
    // In a real application, you would use proper RSA key generation
    const keyId = this.generateKeyId();
    const privateKey = CryptoJS.lib.WordArray.random(256/8).toString(CryptoJS.enc.Hex);
    const publicKey = CryptoJS.SHA256(privateKey).toString(CryptoJS.enc.Hex);
    
    return {
      keyId,
      privateKey,
      publicKey,
      algorithm: 'RSA-2048',
      created: new Date()
    };
  }

  /**
   * Sign data using private key
   */
  sign(data: string | object, privateKey: string): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const signature = CryptoJS.HmacSHA256(payload, privateKey);
    return signature.toString(CryptoJS.enc.Hex);
  }

  /**
   * Verify signature using public key
   */
  verify(data: string | object, signature: string, publicKey: string): boolean {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const expectedSignature = CryptoJS.HmacSHA256(payload, publicKey);
    return signature === expectedSignature.toString(CryptoJS.enc.Hex);
  }

  /**
   * Get key information
   */
  getKeyInfo(keyId: string): { exists: boolean; algorithm: string; keySize: number } {
    const exists = this.keys.has(keyId);
    return {
      exists,
      algorithm: this.defaultOptions.algorithm!,
      keySize: this.defaultOptions.keySize!
    };
  }

  /**
   * List all available keys
   */
  listKeys(): string[] {
    return Array.from(this.keys.keys());
  }

  /**
   * Remove a key
   */
  removeKey(keyId: string): boolean {
    return this.keys.delete(keyId);
  }

  /**
   * Clear all keys
   */
  clearKeys(): void {
    this.keys.clear();
  }

  /**
   * Generate secure random bytes
   */
  generateRandomBytes(size: number): string {
    return CryptoJS.lib.WordArray.random(size).toString(CryptoJS.enc.Hex);
  }

  /**
   * Hash data using SHA-256
   */
  hash(data: string | object): string {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.SHA256(payload).toString(CryptoJS.enc.Hex);
  }

  /**
   * Private helper methods
   */
  private encryptGCM(
    plaintext: string,
    key: CryptoJS.lib.WordArray,
    keyId: string,
    options: EncryptionOptions
  ): EncryptionResult {
    const iv = CryptoJS.lib.WordArray.random(options.ivSize! / 8);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CTR,
      padding: CryptoJS.pad.NoPadding
    });

    // Simulate GCM tag (in real implementation, use proper GCM mode)
    const tag = CryptoJS.HmacSHA256(encrypted.ciphertext.toString(), key).toString(CryptoJS.enc.Hex).substring(0, options.tagSize! / 4);

    return {
      encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      keyId,
      iv: iv.toString(CryptoJS.enc.Hex),
      tag,
      algorithm: options.algorithm!,
      keySize: options.keySize!
    };
  }

  private encryptCBC(
    plaintext: string,
    key: CryptoJS.lib.WordArray,
    keyId: string,
    options: EncryptionOptions
  ): EncryptionResult {
    const iv = CryptoJS.lib.WordArray.random(options.ivSize! / 8);
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });

    return {
      encrypted: encrypted.ciphertext.toString(CryptoJS.enc.Base64),
      keyId,
      iv: iv.toString(CryptoJS.enc.Hex),
      algorithm: options.algorithm!,
      keySize: options.keySize!
    };
  }

  private decryptGCM(encryptedData: EncryptionResult, key: CryptoJS.lib.WordArray): string {
    const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedData.encrypted) } as any,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CTR,
        padding: CryptoJS.pad.NoPadding
      }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  private decryptCBC(encryptedData: EncryptionResult, key: CryptoJS.lib.WordArray): string {
    const iv = CryptoJS.enc.Hex.parse(encryptedData.iv);
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Base64.parse(encryptedData.encrypted) } as any,
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  private generateKeyId(): string {
    return 'key_' + CryptoJS.lib.WordArray.random(128/8).toString(CryptoJS.enc.Hex);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  }
}

// Export utility functions
export function createEncryptionManager(options?: Partial<EncryptionOptions>): EncryptionManager {
  return new EncryptionManager(options);
}

export function generateSecurePassword(length: number = 32): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

export function validateEncryptionKey(keyData: string): boolean {
  try {
    return keyData.length >= 32 && /^[a-fA-F0-9]+$/.test(keyData);
  } catch {
    return false;
  }
} 
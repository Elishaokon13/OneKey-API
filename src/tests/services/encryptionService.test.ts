import { EncryptionService } from '@/services/encryption/encryptionService';
import { 
  EncryptionRequest, 
  DecryptionRequest,
  KeyGenerationRequest,
  EncryptionError,
  DecryptionError,
  KeyManagementError
} from '@/types/encryption';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService({
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
      integrityCheckEnabled: true
    });
  });

  describe('encrypt', () => {
    it('should encrypt data with password', async () => {
      const request: EncryptionRequest = {
        data: 'test data',
        password: 'testPassword123!'
      };

      const result = await service.encrypt(request);

      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.algorithm).toBe('aes-256-gcm');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.dataType).toBe('generic');
    });

    it('should encrypt data with key', async () => {
      // First generate a key
      const keyGenRequest: KeyGenerationRequest = {
        usage: ['encrypt', 'decrypt'],
        expiresIn: 3600
      };
      const key = await service.generateKey(keyGenRequest);

      const request: EncryptionRequest = {
        data: 'test data',
        keyId: key.keyId
      };

      const result = await service.encrypt(request);

      expect(result.encryptedData).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(result.salt).toBeDefined();
      expect(result.authTag).toBeDefined();
      expect(result.algorithm).toBe('aes-256-gcm');
      expect(result.keyId).toBe(key.keyId);
    });

    it('should throw error if neither password nor keyId provided', async () => {
      const request: EncryptionRequest = {
        data: 'test data'
      };

      await expect(service.encrypt(request))
        .rejects
        .toThrow(EncryptionError);
    });
  });

  describe('decrypt', () => {
    it('should decrypt data with password', async () => {
      const originalData = 'test data';
      const password = 'testPassword123!';

      // First encrypt
      const encResult = await service.encrypt({
        data: originalData,
        password
      });

      // Then decrypt
      const decRequest: DecryptionRequest = {
        encryptedData: encResult.encryptedData,
        iv: encResult.iv,
        salt: encResult.salt,
        authTag: encResult.authTag,
        password,
        algorithm: encResult.algorithm
      };

      const result = await service.decrypt(decRequest);

      expect(result.data.toString()).toBe(originalData);
      expect(result.verified).toBe(true);
    });

    it('should decrypt data with key', async () => {
      const originalData = 'test data';

      // Generate key
      const key = await service.generateKey({
        usage: ['encrypt', 'decrypt'],
        expiresIn: 3600
      });

      // Encrypt
      const encResult = await service.encrypt({
        data: originalData,
        keyId: key.keyId
      });

      // Decrypt
      const decRequest: DecryptionRequest = {
        encryptedData: encResult.encryptedData,
        iv: encResult.iv,
        salt: encResult.salt,
        authTag: encResult.authTag,
        keyId: key.keyId,
        algorithm: encResult.algorithm
      };

      const result = await service.decrypt(decRequest);

      expect(result.data.toString()).toBe(originalData);
      expect(result.verified).toBe(true);
    });

    it('should throw error for invalid auth tag', async () => {
      const originalData = 'test data';
      const password = 'testPassword123!';

      // First encrypt
      const encResult = await service.encrypt({
        data: originalData,
        password
      });

      // Modify auth tag
      const decRequest: DecryptionRequest = {
        encryptedData: encResult.encryptedData,
        iv: encResult.iv,
        salt: encResult.salt,
        authTag: 'invalid_auth_tag',
        password,
        algorithm: encResult.algorithm
      };

      await expect(service.decrypt(decRequest))
        .rejects
        .toThrow(DecryptionError);
    });
  });

  describe('key management', () => {
    it('should generate and rotate keys', async () => {
      // Generate initial key
      const keyGenRequest: KeyGenerationRequest = {
        usage: ['encrypt', 'decrypt'],
        expiresIn: 3600
      };
      const key = await service.generateKey(keyGenRequest);

      expect(key.keyId).toBeDefined();
      expect(key.salt).toBeDefined();
      expect(key.derivationConfig).toBeDefined();
      expect(key.expiresAt).toBeDefined();

      // Rotate key
      const rotatedKey = await service.rotateKey(key.keyId);

      expect(rotatedKey.keyId).toBeDefined();
      expect(rotatedKey.keyId).not.toBe(key.keyId);
    });

    it('should throw error when rotating non-existent key', async () => {
      await expect(service.rotateKey('non_existent_key'))
        .rejects
        .toThrow(KeyManagementError);
    });
  });

  describe('key derivation', () => {
    it('should derive consistent keys', async () => {
      const password = 'testPassword123!';
      const salt = 'test_salt';
      const config = {
        algorithm: 'pbkdf2' as const,
        iterations: 100000,
        saltLength: 32,
        keyLength: 32,
        hashFunction: 'sha256' as const
      };

      const key1 = await service.deriveKey(password, salt, config);
      const key2 = await service.deriveKey(password, salt, config);

      expect(key1).toBe(key2);
    });

    it('should throw error for unsupported algorithm', async () => {
      const password = 'testPassword123!';
      const salt = 'test_salt';
      const config = {
        algorithm: 'unsupported' as any,
        iterations: 100000,
        saltLength: 32,
        keyLength: 32
      };

      await expect(service.deriveKey(password, salt, config))
        .rejects
        .toThrow(KeyManagementError);
    });
  });
}); 
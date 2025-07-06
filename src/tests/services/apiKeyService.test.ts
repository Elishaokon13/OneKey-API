import { Pool } from 'pg';
import { ApiKeyService } from '../../services/project/apiKeyService';
import { ApiKeyStatus, ApiKeyType } from '../../types/project';
import { DatabaseError, NotFoundError } from '../../utils/errors';

// Mock the database pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('ApiKeyService', () => {
  let pool: Pool;
  let service: ApiKeyService;
  let mockClient: any;

  beforeEach(() => {
    pool = new Pool();
    service = new ApiKeyService(pool);
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createApiKey', () => {
    const testApiKey = {
      id: '123',
      projectId: 'proj123',
      name: 'Test Key',
      type: ApiKeyType.Secret,
      status: ApiKeyStatus.Active,
      permissions: ['read', 'write'],
      hashedKey: 'hashed_key',
      createdBy: 'user123',
      createdAt: new Date(),
      updatedAt: new Date(),
      lastUsedAt: null,
      metadata: {}
    };

    it('should create an API key', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [testApiKey] }) // key creation
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createApiKey(
        'proj123',
        'Test Key',
        ApiKeyType.Secret,
        ['read', 'write'],
        'user123'
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result.apiKey).toMatch(/^sk_/);
      expect(result.apiKeyDetails).toEqual(testApiKey);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // key creation fails

      await expect(service.createApiKey(
        'proj123',
        'Test Key',
        ApiKeyType.Secret,
        ['read', 'write'],
        'user123'
      )).rejects.toThrow(DatabaseError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getApiKey', () => {
    it('should return API key if found', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        type: ApiKeyType.Secret,
        status: ApiKeyStatus.Active,
        permissions: ['read', 'write'],
        hashedKey: 'hashed_key',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
        metadata: {}
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testApiKey]
      });

      const result = await service.getApiKey('123');
      expect(result).toEqual(testApiKey);
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.getApiKey('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectApiKeys', () => {
    it('should return project API keys', async () => {
      const testApiKeys = [
        {
          id: '123',
          projectId: 'proj123',
          name: 'Key 1',
          type: ApiKeyType.Secret,
          status: ApiKeyStatus.Active,
          permissions: ['read', 'write'],
          hashedKey: 'hashed_key_1',
          createdBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          expiresAt: null,
          metadata: {}
        },
        {
          id: '456',
          projectId: 'proj123',
          name: 'Key 2',
          type: ApiKeyType.Public,
          status: ApiKeyStatus.Revoked,
          permissions: ['read'],
          hashedKey: 'hashed_key_2',
          createdBy: 'user123',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastUsedAt: null,
          expiresAt: null,
          metadata: {}
        }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: testApiKeys
      });

      const result = await service.getProjectApiKeys('proj123');
      expect(result).toEqual(testApiKeys);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        type: ApiKeyType.Secret,
        status: ApiKeyStatus.Active,
        permissions: ['read', 'write'],
        hashedKey: 'hashed_key',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
        metadata: {}
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [testApiKey] }) // key lookup
        .mockResolvedValueOnce({ rows: [testApiKey] }); // last used update

      const result = await service.validateApiKey('test_key');
      expect(result).toBeTruthy();
    });

    it('should return false for invalid API key', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.validateApiKey('invalid_key');
      expect(result).toBeFalsy();
    });

    it('should return false for expired API key', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        type: ApiKeyType.Secret,
        status: ApiKeyStatus.Active,
        permissions: ['read', 'write'],
        hashedKey: 'hashed_key',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: new Date(Date.now() - 86400000), // 1 day ago
        metadata: {}
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [testApiKey] }) // key lookup
        .mockResolvedValueOnce({ rows: [testApiKey] }); // status update

      const result = await service.validateApiKey('test_key');
      expect(result).toBeFalsy();
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        type: ApiKeyType.Secret,
        status: ApiKeyStatus.Revoked,
        permissions: ['read', 'write'],
        hashedKey: 'hashed_key',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: null,
        expiresAt: null,
        metadata: {}
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testApiKey]
      });

      const result = await service.revokeApiKey('123');
      expect(result.status).toBe(ApiKeyStatus.Revoked);
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.revokeApiKey('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateApiKeyLastUsed', () => {
    it('should update last used timestamp', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        name: 'Test Key',
        type: ApiKeyType.Secret,
        status: ApiKeyStatus.Active,
        permissions: ['read', 'write'],
        hashedKey: 'hashed_key',
        createdBy: 'user123',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: null,
        metadata: {}
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testApiKey]
      });

      const result = await service.updateApiKeyLastUsed('123');
      expect(result.lastUsedAt).toBeDefined();
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.updateApiKeyLastUsed('123'))
        .rejects.toThrow(NotFoundError);
    });
  });
}); 
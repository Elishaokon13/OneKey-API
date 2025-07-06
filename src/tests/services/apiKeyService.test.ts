import { Pool } from 'pg';
import { ApiKeyService } from '../../services/project/apiKeyService';
import { ApiKeyStatus } from '../../types/project';
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
      key: 'pk_test_123',
      hashedKey: 'hashed_key',
      status: ApiKeyStatus.Active,
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
        {}
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result.key).toBeDefined();
      expect(result.hashedKey).toBeDefined();
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // key creation fails

      await expect(service.createApiKey(
        'proj123',
        'Test Key',
        {}
      )).rejects.toThrow(DatabaseError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getApiKey', () => {
    it('should return API key if found', async () => {
      const testApiKey = {
        id: '123',
        name: 'Test Key',
        status: ApiKeyStatus.Active
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

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      const testApiKey = {
        id: '123',
        status: ApiKeyStatus.Revoked
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

  describe('getProjectApiKeys', () => {
    it('should return project API keys', async () => {
      const testApiKeys = [
        { id: '123', name: 'Key 1', status: ApiKeyStatus.Active },
        { id: '456', name: 'Key 2', status: ApiKeyStatus.Revoked }
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
        hashedKey: 'hashed_key',
        status: ApiKeyStatus.Active
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testApiKey]
      });

      const result = await service.validateApiKey('pk_test_123');
      expect(result).toBeTruthy();
    });

    it('should return false for invalid API key', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      const result = await service.validateApiKey('invalid_key');
      expect(result).toBeFalsy();
    });

    it('should return false for revoked API key', async () => {
      const testApiKey = {
        id: '123',
        projectId: 'proj123',
        hashedKey: 'hashed_key',
        status: ApiKeyStatus.Revoked
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testApiKey]
      });

      const result = await service.validateApiKey('pk_test_123');
      expect(result).toBeFalsy();
    });
  });

  describe('updateApiKeyLastUsed', () => {
    it('should update last used timestamp', async () => {
      const testApiKey = {
        id: '123',
        lastUsedAt: new Date()
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
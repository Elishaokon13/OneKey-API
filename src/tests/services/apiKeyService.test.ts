import { Pool } from 'pg';
import { ApiKeyService } from '../../services/project/apiKeyService';
import { ApiKeyType, ApiKeyStatus } from '../../types/project';
import { NotFoundError } from '../../utils/errors';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn()
    };

    service = new ApiKeyService(mockPool);
  });

  const testApiKey = {
    id: '123',
    projectId: 'proj123',
    name: 'Test Key',
    type: ApiKeyType.Secret,
    status: ApiKeyStatus.Active,
    permissions: ['read', 'write'],
    hashedKey: 'hashed_key',
    createdBy: 'user123',
    createdAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z'),
    lastUsedAt: null,
    expiresAt: null,
    metadata: {}
  };

  const dbApiKey = {
    id: '123',
    project_id: 'proj123',
    name: 'Test Key',
    type: ApiKeyType.Secret,
    status: ApiKeyStatus.Active,
    permissions: ['read', 'write'],
    hashed_key: 'hashed_key',
    created_by: 'user123',
    created_at: new Date('2025-07-06T01:29:26.221Z'),
    updated_at: new Date('2025-07-06T01:29:26.221Z'),
    last_used_at: null,
    expires_at: null,
    metadata: {}
  };

  describe('createApiKey', () => {
    it('should create an API key', async () => {
      const apiKey = 'sk_test_123';
      const hashedKey = 'hashed_key';

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [dbApiKey] }) // Insert API key
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
  });

  describe('getApiKey', () => {
    it('should return API key if found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [dbApiKey] });

      const result = await service.getApiKey('123');
      expect(result).toEqual(testApiKey);
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getApiKey('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectApiKeys', () => {
    it('should return project API keys', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [dbApiKey, { ...dbApiKey, id: '456', name: 'Test Key 2' }]
      });

      const result = await service.getProjectApiKeys('proj123');
      expect(result).toEqual([
        testApiKey,
        { ...testApiKey, id: '456', name: 'Test Key 2' }
      ]);
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [dbApiKey] }) // Key lookup
        .mockResolvedValueOnce({ rows: [{ ...dbApiKey, last_used_at: new Date() }] }); // Update last used

      const result = await service.validateApiKey('sk_test_123');
      expect(result).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.validateApiKey('invalid_key');
      expect(result).toBe(false);
    });

    it('should return false for expired API key', async () => {
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            ...dbApiKey,
            status: ApiKeyStatus.Expired,
            expires_at: new Date('2020-01-01')
          }]
        })
        .mockResolvedValueOnce({ rows: [{ ...dbApiKey, status: ApiKeyStatus.Expired }] }); // Status update

      const result = await service.validateApiKey('sk_test_123');
      expect(result).toBe(false);
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...dbApiKey, status: ApiKeyStatus.Revoked }]
      });

      const result = await service.revokeApiKey('123');
      expect(result).toEqual({ ...testApiKey, status: ApiKeyStatus.Revoked });
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.revokeApiKey('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateApiKeyLastUsed', () => {
    const now = new Date();

    it('should update last used timestamp', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ ...dbApiKey, last_used_at: now }]
      });

      const result = await service.updateApiKeyLastUsed('123');
      expect(result).toEqual({ ...testApiKey, lastUsedAt: now });
    });

    it('should throw NotFoundError if API key not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateApiKeyLastUsed('123'))
        .rejects.toThrow(NotFoundError);
    });
  });
}); 
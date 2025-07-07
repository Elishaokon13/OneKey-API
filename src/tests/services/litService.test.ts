import { LitService } from '../../services/encryption/litService';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { RedisService } from '../../services/cache/redisService';
import { EncryptionKeyRequest } from '../../types/lit';

jest.mock('@lit-protocol/lit-node-client');
jest.mock('../../services/cache/redisService');

describe('LitService', () => {
  let service: LitService;
  let mockLitNodeClient: jest.Mocked<LitNodeClient>;
  let mockRedis: jest.Mocked<RedisService>;

  const mockRequest: EncryptionKeyRequest = {
    projectId: 'project123',
    accessControlConditions: [
      {
        contractAddress: '0x123',
        standardContractType: 'ERC20',
        chain: 'ethereum',
        method: 'balanceOf',
        parameters: ['address'],
        returnValueTest: {
          comparator: '>',
          value: '100'
        }
      }
    ],
    chain: 'ethereum'
  };

  beforeEach(() => {
    mockLitNodeClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      saveEncryptionKey: jest.fn().mockResolvedValue('encryptionKey123'),
      getEncryptionKey: jest.fn().mockResolvedValue('encryptionKey123'),
      disconnect: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<LitNodeClient>;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      connect: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    jest.spyOn(RedisService, 'getInstance').mockReturnValue(mockRedis);
    service = new LitService();
    service['client'] = mockLitNodeClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('saveEncryptionKey', () => {
    it('should save encryption key successfully', async () => {
      const result = await service.saveEncryptionKey(mockRequest);
      expect(result).toBe('encryptionKey123');
      expect(mockLitNodeClient.saveEncryptionKey).toHaveBeenCalledWith({
        accessControlConditions: mockRequest.accessControlConditions,
        chain: mockRequest.chain,
        permanent: false
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Lit error');
      mockLitNodeClient.saveEncryptionKey.mockRejectedValueOnce(error);

      await expect(service.saveEncryptionKey(mockRequest))
        .rejects.toThrow('Failed to save encryption key');
    });
  });

  describe('getEncryptionKey', () => {
    it('should get encryption key successfully', async () => {
      const result = await service.getEncryptionKey(mockRequest);
      expect(result).toBe('encryptionKey123');
      expect(mockLitNodeClient.getEncryptionKey).toHaveBeenCalledWith({
        accessControlConditions: mockRequest.accessControlConditions,
        chain: mockRequest.chain,
        toDecrypt: true
      });
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Lit error');
      mockLitNodeClient.getEncryptionKey.mockRejectedValueOnce(error);

      await expect(service.getEncryptionKey(mockRequest))
        .rejects.toThrow('Failed to get encryption key');
    });
  });

  describe('disconnect', () => {
    it('should disconnect client if connected', async () => {
      await service.disconnect();
      expect(mockLitNodeClient.disconnect).toHaveBeenCalled();
    });

    it('should handle null client gracefully', async () => {
      service['client'] = null;
      await service.disconnect();
      expect(mockLitNodeClient.disconnect).not.toHaveBeenCalled();
    });
  });
}); 
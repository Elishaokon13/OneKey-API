import { LitService } from '../../services/encryption/litService';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { RedisService } from '../../services/cache/redisService';
import { EncryptionKeyRequest } from '../../types/lit';
import { ISessionCapabilityObject, LitAbility } from '@lit-protocol/types';
import { logger } from '../../utils/logger';

jest.mock('@lit-protocol/lit-node-client');
jest.mock('../../services/cache/redisService');
jest.mock('../../utils/logger');

class MockSessionCapabilityObject implements ISessionCapabilityObject {
  private _attenuations: Record<string, Record<string, any[]>> = {};
  private _proofs: string[] = [];
  private _statement: string = '';

  get attenuations() { return this._attenuations; }
  get proofs() { return this._proofs; }
  get statement() { return this._statement; }

  addProof(proof: string) { this._proofs.push(proof); }
  
  addAttenuation(resource: string, namespace?: string, name?: string, restriction?: any) {
    if (!this._attenuations[resource]) {
      this._attenuations[resource] = {};
    }
    if (namespace && name) {
      if (!this._attenuations[resource][namespace]) {
        this._attenuations[resource][namespace] = [];
      }
      this._attenuations[resource][namespace].push({ name, ...restriction });
    }
  }

  addToSiweMessage(siwe: any) { return siwe; }
  encodeAsSiweResource() { return ''; }
  
  addCapabilityForResource(litResource: any, ability: LitAbility) {
    this.addAttenuation(litResource.getResourceKey(), 'lit-capability', ability);
  }
  
  verifyCapabilitiesForResource() { return true; }
  addAllCapabilitiesForResource() {}
}

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
      saveEncryptionKey: jest.fn().mockResolvedValue({ encryptedSymmetricKey: 'encryptedKey123', symmetricKey: new Uint8Array([1, 2, 3]) }),
      getEncryptionKey: jest.fn().mockResolvedValue({ encryptedSymmetricKey: 'encryptedKey123', symmetricKey: new Uint8Array([1, 2, 3]) }),
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
      expect(result).toEqual({
        encryptedSymmetricKey: 'encryptedKey123',
        symmetricKey: expect.any(Uint8Array)
      });
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
      expect(logger.error).toHaveBeenCalledWith('Failed to save encryption key', { error });
    });
  });

  describe('getEncryptionKey', () => {
    it('should get encryption key successfully', async () => {
      const result = await service.getEncryptionKey(mockRequest);
      expect(result).toEqual({
        encryptedSymmetricKey: 'encryptedKey123',
        symmetricKey: expect.any(Uint8Array)
      });
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
      expect(logger.error).toHaveBeenCalledWith('Failed to get encryption key', { error });
    });

    it('should handle null response gracefully', async () => {
      mockLitNodeClient.getEncryptionKey.mockResolvedValueOnce(null);

      const result = await service.getEncryptionKey(mockRequest);
      expect(result).toEqual({
        encryptedSymmetricKey: '',
        symmetricKey: new Uint8Array()
      });
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
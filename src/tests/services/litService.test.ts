import { LitService } from '@/services/encryption/litService';
import { LitNetwork, EncryptionKeyRequest } from '@/types/lit';
import { config } from '@/config/environment';

// Mock LitNodeClient
jest.mock('@lit-protocol/lit-node-client', () => {
  return {
    LitNodeClient: jest.fn().mockImplementation(() => ({
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      saveEncryptionKey: jest.fn().mockResolvedValue({
        encryptedSymmetricKey: 'mockEncryptedKey',
        symmetricKey: new Uint8Array([1, 2, 3])
      }),
      getEncryptionKey: jest.fn().mockResolvedValue({
        encryptedSymmetricKey: 'mockEncryptedKey',
        symmetricKey: new Uint8Array([1, 2, 3])
      }),
      generateAuthSig: jest.fn().mockResolvedValue({
        sig: 'mockSignature',
        derivedVia: 'web3.eth.personal.sign',
        signedMessage: 'mockMessage',
        address: '0x1234'
      })
    }))
  };
});

describe('LitService', () => {
  let service: LitService;
  const mockConfig = {
    network: LitNetwork.Cayenne,
    debug: true,
    minNodeCount: 5,
    maxNodeCount: 10
  };

  beforeEach(() => {
    service = new LitService(mockConfig);
  });

  describe('initialize', () => {
    it('should initialize Lit Protocol client successfully', async () => {
      await service.initialize();
      expect(service['isInitialized']).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      await service.initialize();
      expect(service['client'].connect).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const mockError = new Error('Connection failed');
      jest.spyOn(service['client'], 'connect').mockRejectedValueOnce(mockError);

      await expect(service.initialize()).rejects.toThrow('Connection failed');
      expect(service['isInitialized']).toBe(false);
    });
  });

  describe('saveEncryptionKey', () => {
    const mockRequest: EncryptionKeyRequest = {
      accessControlConditions: [
        {
          contractAddress: config.blockchain.easContractAddress,
          standardContractType: 'ERC1155',
          chain: 'base',
          method: 'balanceOf',
          parameters: [':userAddress', 'userId123'],
          returnValueTest: {
            comparator: '>',
            value: '0'
          }
        }
      ],
      chain: 'base'
    };

    it('should save encryption key successfully', async () => {
      await service.initialize();
      const response = await service.saveEncryptionKey(mockRequest);
      
      expect(response.encryptedSymmetricKey).toBe('mockEncryptedKey');
      expect(response.symmetricKey).toBeInstanceOf(Uint8Array);
    });

    it('should auto-initialize if not initialized', async () => {
      const response = await service.saveEncryptionKey(mockRequest);
      
      expect(service['isInitialized']).toBe(true);
      expect(response.encryptedSymmetricKey).toBe('mockEncryptedKey');
    });

    it('should generate auth signature if not provided', async () => {
      await service.initialize();
      await service.saveEncryptionKey(mockRequest);
      
      expect(service['client'].generateAuthSig).toHaveBeenCalled();
    });

    it('should validate request parameters', async () => {
      await service.initialize();
      
      const invalidRequest = { ...mockRequest, accessControlConditions: [] };
      await expect(service.saveEncryptionKey(invalidRequest)).rejects.toThrow('Access control conditions are required');
      
      const noChainRequest = { ...mockRequest, chain: '' };
      await expect(service.saveEncryptionKey(noChainRequest)).rejects.toThrow('Chain is required');
    });
  });

  describe('getEncryptionKey', () => {
    const mockRequest: EncryptionKeyRequest = {
      accessControlConditions: [
        {
          contractAddress: config.blockchain.easContractAddress,
          standardContractType: 'ERC1155',
          chain: 'base',
          method: 'balanceOf',
          parameters: [':userAddress', 'userId123'],
          returnValueTest: {
            comparator: '>',
            value: '0'
          }
        }
      ],
      chain: 'base'
    };

    it('should get encryption key successfully', async () => {
      await service.initialize();
      const response = await service.getEncryptionKey(mockRequest);
      
      expect(response.encryptedSymmetricKey).toBe('mockEncryptedKey');
      expect(response.symmetricKey).toBeInstanceOf(Uint8Array);
    });

    it('should auto-initialize if not initialized', async () => {
      const response = await service.getEncryptionKey(mockRequest);
      
      expect(service['isInitialized']).toBe(true);
      expect(response.encryptedSymmetricKey).toBe('mockEncryptedKey');
    });

    it('should generate auth signature if not provided', async () => {
      await service.initialize();
      await service.getEncryptionKey(mockRequest);
      
      expect(service['client'].generateAuthSig).toHaveBeenCalled();
    });

    it('should validate request parameters', async () => {
      await service.initialize();
      
      const invalidRequest = { ...mockRequest, accessControlConditions: [] };
      await expect(service.getEncryptionKey(invalidRequest)).rejects.toThrow('Access control conditions are required');
      
      const noChainRequest = { ...mockRequest, chain: '' };
      await expect(service.getEncryptionKey(noChainRequest)).rejects.toThrow('Chain is required');
    });
  });

  describe('createKycAccessConditions', () => {
    it('should create valid access control conditions', () => {
      const conditions = service.createKycAccessConditions('userId123', 'projectId456');
      
      expect(conditions).toHaveLength(2);
      expect(conditions[0].method).toBe('balanceOf');
      expect(conditions[0].parameters).toContain('userId123');
      expect(conditions[1].method).toBe('isProjectAuthorized');
      expect(conditions[1].parameters).toContain('projectId456');
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully when initialized', async () => {
      await service.initialize();
      await service.disconnect();
      
      expect(service['isInitialized']).toBe(false);
      expect(service['client'].disconnect).toHaveBeenCalled();
    });

    it('should not attempt to disconnect when not initialized', async () => {
      await service.disconnect();
      
      expect(service['client'].disconnect).not.toHaveBeenCalled();
    });
  });
}); 
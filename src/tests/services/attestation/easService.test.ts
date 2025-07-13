import { ethers } from 'ethers';
import { EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { EasService } from '../../../services/attestation/easService';
import { SchemaManager } from '../../../services/attestation/schemaManager';
import { ArweaveService } from '../../../services/storage/arweaveService';
import {
  EasAttestation,
  CreateAttestationRequest,
  AttestationVerificationResult,
  AttestationCreationError,
  AttestationNotFoundError,
  EasConfig
} from '../../../types/attestation';
import { KycVerificationResult } from '../../../types/kyc';
import { logger } from '../../../utils/logger';

jest.mock('ethers');
jest.mock('@ethereum-attestation-service/eas-sdk');
jest.mock('../../../services/attestation/schemaManager');
jest.mock('../../../services/storage/arweaveService');
jest.mock('../../../utils/logger');

describe('EasService', () => {
  let easService: EasService;
  let mockProvider: jest.Mocked<ethers.JsonRpcProvider>;
  let mockSigner: jest.Mocked<ethers.Wallet>;
  let mockEAS: jest.Mocked<EAS>;
  let mockSchemaEncoder: jest.Mocked<SchemaEncoder>;
  let mockSchemaManager: jest.Mocked<SchemaManager>;
  let mockArweaveService: jest.Mocked<ArweaveService>;

  const mockEasConfig: EasConfig = {
    chainId: 84532, // Base Sepolia
    rpcUrl: 'https://sepolia.base.org',
    contractAddress: '0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587',
    schemaRegistryAddress: '0x0a7E2Ff54e76B8E6659aedc9103FB21044c6B233',
    attesterPrivateKey: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    attesterAddress: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
    defaultSchemaId: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    gasLimit: 500000,
    gasPrice: '20',
    gasPriceStrategy: 'estimate',
    enableRevocation: true,
    defaultExpirationHours: 8760,
    autoCreateOnKyc: true,
    maxAttestationsPerHour: 50,
    maxAttestationsPerDay: 200
  };

  const mockKycResult: KycVerificationResult = {
    sessionId: 'kyc-session-123',
    provider: 'smile-identity',
    status: 'completed',
    confidence: 95,
    checks: {
      documentVerified: true,
      biometricVerified: true,
      livenessVerified: true,
      addressVerified: false,
      sanctionsCleared: true,
      pepCleared: true
    },
    riskAssessment: {
      level: 'low',
      score: 15,
      factors: []
    },
    documentData: {
      type: 'passport',
      country: 'NG',
      issuedAt: '2020-01-01',
      expiresAt: '2030-01-01',
      verified: true
    },
    user: {
      id: 'user-123',
      email: 'test@example.com'
    },
    metadata: {
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent'
    },
    completedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };

  beforeEach(() => {
    // Mock ethers components
    mockProvider = {
      getNetwork: jest.fn().mockResolvedValue({ chainId: BigInt(84532) }),
      getBlock: jest.fn().mockResolvedValue({
        timestamp: Math.floor(Date.now() / 1000),
        number: 12345
      }),
      getBlockNumber: jest.fn().mockResolvedValue(12345)
    } as any;

    mockSigner = {
      getAddress: jest.fn().mockResolvedValue(mockEasConfig.attesterAddress),
      connect: jest.fn()
    } as any;

    (ethers.JsonRpcProvider as jest.Mock).mockReturnValue(mockProvider);
    (ethers.Wallet as jest.Mock).mockReturnValue(mockSigner);

    // Mock EAS SDK components
    mockEAS = {
      connect: jest.fn(),
      attest: jest.fn(),
      multiAttest: jest.fn(),
      getAttestation: jest.fn(),
      revoke: jest.fn()
    } as any;

    mockSchemaEncoder = {
      encodeData: jest.fn().mockReturnValue('0x1234567890abcdef')
    } as any;

    (EAS as jest.Mock).mockReturnValue(mockEAS);
    (SchemaEncoder as jest.Mock).mockReturnValue(mockSchemaEncoder);

    // Mock SchemaManager
    mockSchemaManager = {
      initialize: jest.fn(),
      getSchema: jest.fn(),
      validateSchema: jest.fn().mockResolvedValue({ valid: true, errors: [] })
    } as any;

    (SchemaManager as jest.Mock).mockReturnValue(mockSchemaManager);

    // Mock ArweaveService
    mockArweaveService = {
      uploadData: jest.fn()
    } as any;

    (ArweaveService as jest.Mock).mockReturnValue(mockArweaveService);

    // Initialize service
    easService = new EasService(mockEasConfig);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(easService.initialize()).resolves.not.toThrow();

      expect(ethers.JsonRpcProvider).toHaveBeenCalledWith(mockEasConfig.rpcUrl);
      expect(ethers.Wallet).toHaveBeenCalledWith(mockEasConfig.attesterPrivateKey, mockProvider);
      expect(EAS).toHaveBeenCalledWith(mockEasConfig.contractAddress);
      expect(mockEAS.connect).toHaveBeenCalledWith(mockSigner);
    });

    it('should throw error if signer address mismatch', async () => {
      mockSigner.getAddress.mockResolvedValue('0xDifferentAddress');

      await expect(easService.initialize()).rejects.toThrow('Signer address mismatch');
    });

    it('should throw error if chain ID mismatch', async () => {
      mockProvider.getNetwork.mockResolvedValue({ chainId: BigInt(1) }); // Mainnet instead of Base Sepolia

      await expect(easService.initialize()).rejects.toThrow('Chain ID mismatch');
    });
  });

  describe('createKycAttestation', () => {
    const recipient = '0x742d35Cc6634C0532925a3b8D400EeA9615F8327';

    beforeEach(async () => {
      await easService.initialize();
    });

    it('should create KYC attestation successfully', async () => {
      const mockTransactionReceipt = {
        hash: '0xabcdef123456',
        blockNumber: 12345,
        gasUsed: BigInt(300000),
        gasPrice: BigInt(20000000000),
        logs: [
          {
            topics: [
              '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f7de2c68133f5562dfa6a509bc300', // Attested event
              '0x742d35Cc6634C0532925a3b8D400EeA9615F8327', // recipient
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' // attester
            ],
            data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          }
        ]
      };

      mockEAS.attest.mockResolvedValue({
        transaction: { hash: '0xabcdef123456' },
        receipt: mockTransactionReceipt
      });

      const result = await easService.createKycAttestation(recipient, mockKycResult);

      expect(result).toMatchObject({
        recipient,
        attester: mockEasConfig.attesterAddress,
        chainId: mockEasConfig.chainId,
        status: 'confirmed',
        revoked: false
      });

      expect(result.uid).toBeDefined();
      expect(result.transactionHash).toBe('0xabcdef123456');
      expect(result.data.kycProvider).toBe('smile-identity');
      expect(result.data.verificationStatus).toBe('verified');
    });

    it('should handle transaction failure gracefully', async () => {
      mockEAS.attest.mockRejectedValue(new Error('Transaction failed'));

      await expect(
        easService.createKycAttestation(recipient, mockKycResult)
      ).rejects.toThrow(AttestationCreationError);
    });

    it('should encode attestation data correctly', async () => {
      const mockTransactionReceipt = {
        hash: '0xabcdef123456',
        blockNumber: 12345,
        gasUsed: BigInt(300000),
        logs: [
          {
            topics: [
              '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f7de2c68133f5562dfa6a509bc300',
              '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            ],
            data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          }
        ]
      };

      mockEAS.attest.mockResolvedValue({
        transaction: { hash: '0xabcdef123456' },
        receipt: mockTransactionReceipt
      });

      await easService.createKycAttestation(recipient, mockKycResult);

      expect(mockSchemaEncoder.encodeData).toHaveBeenCalledWith([
        { name: 'kycProvider', value: 'smile-identity', type: 'string' },
        { name: 'kycSessionId', value: 'kyc-session-123', type: 'string' },
        { name: 'verificationStatus', value: 'verified', type: 'string' },
        expect.objectContaining({ name: 'verificationTimestamp', type: 'uint256' }),
        { name: 'confidenceScore', value: 95, type: 'uint256' },
        expect.objectContaining({ name: 'userIdHash', type: 'string' }),
        { name: 'countryCode', value: 'NG', type: 'string' },
        { name: 'documentType', value: 'passport', type: 'string' },
        { name: 'documentVerified', value: true, type: 'bool' },
        { name: 'biometricVerified', value: true, type: 'bool' },
        { name: 'livenessVerified', value: true, type: 'bool' },
        { name: 'addressVerified', value: false, type: 'bool' },
        { name: 'sanctionsCleared', value: true, type: 'bool' },
        { name: 'pepCleared', value: true, type: 'bool' },
        { name: 'riskLevel', value: 'low', type: 'string' },
        { name: 'riskScore', value: 15, type: 'uint256' },
        expect.objectContaining({ name: 'schemaVersion', type: 'string' }),
        expect.objectContaining({ name: 'apiVersion', type: 'string' }),
        expect.objectContaining({ name: 'attestationStandard', type: 'string' })
      ]);
    });

    it('should handle custom expiration time', async () => {
      const customExpirationTime = Math.floor(Date.now() / 1000) + 86400; // 24 hours
      const mockTransactionReceipt = {
        hash: '0xabcdef123456',
        blockNumber: 12345,
        gasUsed: BigInt(300000),
        logs: [
          {
            topics: [
              '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f7de2c68133f5562dfa6a509bc300',
              '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
              '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
            ],
            data: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          }
        ]
      };

      mockEAS.attest.mockResolvedValue({
        transaction: { hash: '0xabcdef123456' },
        receipt: mockTransactionReceipt
      });

      const result = await easService.createKycAttestation(recipient, mockKycResult, {
        expirationTime: customExpirationTime
      });

      expect(mockEAS.attest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expirationTime: BigInt(customExpirationTime)
          })
        })
      );
    });
  });

  describe('verifyAttestation', () => {
    const attestationUID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    beforeEach(async () => {
      await easService.initialize();
    });

    it('should verify valid attestation successfully', async () => {
      const mockOnChainAttestation = {
        uid: attestationUID,
        schema: mockEasConfig.defaultSchemaId,
        attester: mockEasConfig.attesterAddress,
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        revocationTime: 0n,
        expirationTime: BigInt(Math.floor(Date.now() / 1000) + 86400), // 24 hours from now
        data: '0x1234567890abcdef'
      };

      mockEAS.getAttestation.mockResolvedValue(mockOnChainAttestation);

      const result = await easService.verifyAttestation(attestationUID);

      expect(result.valid).toBe(true);
      expect(result.verification).toMatchObject({
        onChain: true,
        schemaValid: true,
        notRevoked: true,
        notExpired: true,
        attesterValid: true,
        recipientMatch: true
      });
      expect(result.attestation).toBeDefined();
    });

    it('should detect revoked attestation', async () => {
      const mockOnChainAttestation = {
        uid: attestationUID,
        schema: mockEasConfig.defaultSchemaId,
        attester: mockEasConfig.attesterAddress,
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        revocationTime: BigInt(Math.floor(Date.now() / 1000)), // Revoked now
        expirationTime: BigInt(Math.floor(Date.now() / 1000) + 86400),
        data: '0x1234567890abcdef'
      };

      mockEAS.getAttestation.mockResolvedValue(mockOnChainAttestation);

      const result = await easService.verifyAttestation(attestationUID);

      expect(result.valid).toBe(false);
      expect(result.verification.notRevoked).toBe(false);
      expect(result.errors).toContain('Attestation has been revoked');
    });

    it('should detect expired attestation', async () => {
      const mockOnChainAttestation = {
        uid: attestationUID,
        schema: mockEasConfig.defaultSchemaId,
        attester: mockEasConfig.attesterAddress,
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        revocationTime: 0n,
        expirationTime: BigInt(Math.floor(Date.now() / 1000) - 86400), // Expired 24 hours ago
        data: '0x1234567890abcdef'
      };

      mockEAS.getAttestation.mockResolvedValue(mockOnChainAttestation);

      const result = await easService.verifyAttestation(attestationUID);

      expect(result.valid).toBe(false);
      expect(result.verification.notExpired).toBe(false);
      expect(result.errors).toContain('Attestation has expired');
    });

    it('should handle non-existent attestation', async () => {
      mockEAS.getAttestation.mockResolvedValue(null);

      await expect(
        easService.verifyAttestation(attestationUID)
      ).rejects.toThrow(AttestationNotFoundError);
    });

    it('should detect invalid schema', async () => {
      const mockOnChainAttestation = {
        uid: attestationUID,
        schema: '0xInvalidSchemaId',
        attester: mockEasConfig.attesterAddress,
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        revocationTime: 0n,
        expirationTime: BigInt(Math.floor(Date.now() / 1000) + 86400),
        data: '0x1234567890abcdef'
      };

      mockEAS.getAttestation.mockResolvedValue(mockOnChainAttestation);

      const result = await easService.verifyAttestation(attestationUID);

      expect(result.valid).toBe(false);
      expect(result.verification.schemaValid).toBe(false);
      expect(result.errors).toContain('Invalid schema ID');
    });

    it('should detect invalid attester', async () => {
      const mockOnChainAttestation = {
        uid: attestationUID,
        schema: mockEasConfig.defaultSchemaId,
        attester: '0xInvalidAttester',
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        revocationTime: 0n,
        expirationTime: BigInt(Math.floor(Date.now() / 1000) + 86400),
        data: '0x1234567890abcdef'
      };

      mockEAS.getAttestation.mockResolvedValue(mockOnChainAttestation);

      const result = await easService.verifyAttestation(attestationUID);

      expect(result.valid).toBe(false);
      expect(result.verification.attesterValid).toBe(false);
      expect(result.errors).toContain('Invalid attester address');
    });
  });

  describe('createBatchAttestations', () => {
    const recipients = [
      '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
      '0x8ba1f109551bD432803012645Hac136c8ce3512',
      '0x1234567890123456789012345678901234567890'
    ];

    beforeEach(async () => {
      await easService.initialize();
    });

    it('should create batch attestations successfully', async () => {
      const requests: CreateAttestationRequest[] = recipients.map((recipient, index) => ({
        recipient,
        kycResult: { ...mockKycResult, sessionId: `kyc-session-${index}` },
        requestId: `request-${index}`,
        timestamp: Date.now()
      }));

      const mockTransactionReceipt = {
        hash: '0xbatchTransactionHash',
        blockNumber: 12345,
        gasUsed: BigInt(900000),
        logs: requests.map((_, index) => ({
          topics: [
            '0x8bf46bf4cfd674fa735a3d63ec1c9ad4153f7de2c68133f5562dfa6a509bc300',
            recipients[index],
            '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
          ],
          data: `0x123456789${index}abcdef1234567890abcdef1234567890abcdef1234567890abcdef`
        }))
      };

      mockEAS.multiAttest.mockResolvedValue({
        transaction: { hash: '0xbatchTransactionHash' },
        receipt: mockTransactionReceipt
      });

      const results = await easService.createBatchAttestations(requests);

      expect(results).toHaveLength(3);
      expect(results.every(result => result.status === 'confirmed')).toBe(true);
      expect(results.every(result => result.transactionHash === '0xbatchTransactionHash')).toBe(true);
    });

    it('should handle batch size limits', async () => {
      // Create requests for more than the batch size (10)
      const largeRequests: CreateAttestationRequest[] = Array.from({ length: 25 }, (_, index) => ({
        recipient: recipients[index % recipients.length],
        kycResult: { ...mockKycResult, sessionId: `kyc-session-${index}` },
        requestId: `request-${index}`,
        timestamp: Date.now()
      }));

      const mockTransactionReceipt = {
        hash: '0xbatchTransactionHash',
        blockNumber: 12345,
        gasUsed: BigInt(900000),
        logs: []
      };

      mockEAS.multiAttest.mockResolvedValue({
        transaction: { hash: '0xbatchTransactionHash' },
        receipt: mockTransactionReceipt
      });

      const results = await easService.createBatchAttestations(largeRequests);

      // Should be called 3 times (10 + 10 + 5)
      expect(mockEAS.multiAttest).toHaveBeenCalledTimes(3);
      expect(results).toHaveLength(25);
    });
  });

  describe('estimateGasCost', () => {
    beforeEach(async () => {
      await easService.initialize();
    });

    it('should estimate gas cost for single attestation', async () => {
      const request: CreateAttestationRequest = {
        recipient: '0x742d35Cc6634C0532925a3b8D400EeA9615F8327',
        kycResult: mockKycResult,
        requestId: 'test-request',
        timestamp: Date.now()
      };

      const gasEstimate = await easService.estimateAttestationCost(request);

      expect(gasEstimate).toMatchObject({
        gasLimit: expect.any(Number),
        gasPrice: expect.any(String),
        totalCost: expect.any(String),
        estimatedConfirmationTime: expect.any(Number)
      });

      expect(gasEstimate.gasLimit).toBeGreaterThan(0);
      expect(parseFloat(gasEstimate.totalCost)).toBeGreaterThan(0);
    });
  });

  describe('revokeAttestation', () => {
    const attestationUID = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    beforeEach(async () => {
      await easService.initialize();
    });

    it('should revoke attestation successfully', async () => {
      const mockTransactionReceipt = {
        hash: '0xrevokeTransactionHash',
        blockNumber: 12346,
        gasUsed: BigInt(100000)
      };

      mockEAS.revoke.mockResolvedValue({
        transaction: { hash: '0xrevokeTransactionHash' },
        receipt: mockTransactionReceipt
      });

      const result = await easService.revokeAttestation(attestationUID, 'User request');

      expect(result).toBe(true);
      expect(mockEAS.revoke).toHaveBeenCalledWith({
        schema: mockEasConfig.defaultSchemaId,
        data: {
          uid: attestationUID,
          value: 0n
        }
      });
    });

    it('should handle revocation failure', async () => {
      mockEAS.revoke.mockRejectedValue(new Error('Revocation failed'));

      const result = await easService.revokeAttestation(attestationUID, 'Test reason');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await easService.initialize();
    });

    it('should handle network errors gracefully', async () => {
      mockProvider.getNetwork.mockRejectedValue(new Error('Network error'));

      await expect(easService.initialize()).rejects.toThrow();
    });

    it('should handle contract interaction errors', async () => {
      mockEAS.attest.mockRejectedValue(new Error('Contract error'));

      await expect(
        easService.createKycAttestation('0x742d35Cc6634C0532925a3b8D400EeA9615F8327', mockKycResult)
      ).rejects.toThrow(AttestationCreationError);
    });
  });
}); 
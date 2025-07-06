// OneKey KYC API - Lit Protocol Service
// Handles access control and key sharing for encrypted data

import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LIT_NETWORKS } from '@lit-protocol/constants';
import {
  LitAbility,
  ILitResource,
  LitNodeClientConfig,
  GetWalletSigProps,
  EncryptSdkParams,
  DecryptRequest,
  ISessionCapabilityObject
} from '@lit-protocol/types';
import {
  LitConfig,
  LitNetwork,
  AccessControlCondition,
  EncryptionKeyRequest,
  EncryptionKeyResponse,
  LitError
} from '@/types/lit';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

export class LitService {
  private client!: LitNodeClient;
  private isInitialized: boolean = false;
  private readonly config: LitConfig;

  constructor(litConfig?: Partial<LitConfig>) {
    this.config = {
      network: (litConfig?.network || config.storage.litProtocolNetwork) as LitNetwork,
      debug: litConfig?.debug || false,
      minNodeCount: litConfig?.minNodeCount || 10,
      maxNodeCount: litConfig?.maxNodeCount || 15,
      bootstrapUrls: litConfig?.bootstrapUrls || [],
      fallbackBootstrapUrls: litConfig?.fallbackBootstrapUrls || []
    };
  }

  /**
   * Initialize Lit Protocol client
   */
  public async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      logger.info('Initializing Lit Protocol service', {
        network: this.config.network,
        minNodeCount: this.config.minNodeCount
      });

      const clientConfig: LitNodeClientConfig = {
        litNetwork: this.config.network as keyof typeof LIT_NETWORKS,
        debug: this.config.debug || false,
        minNodeCount: this.config.minNodeCount || 10
      };

      this.client = new LitNodeClient(clientConfig);
      await this.client.connect();
      this.isInitialized = true;

      logger.info('Lit Protocol service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Lit Protocol service', { error });
      throw this.wrapError(error, 'INITIALIZATION_FAILED');
    }
  }

  /**
   * Save encryption key with access control conditions
   */
  public async saveEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse> {
    try {
      await this.ensureInitialized();

      // Validate request
      this.validateRequest(request);

      // Generate auth signature if not provided
      if (!request.authSig) {
        const sessionCapabilityObject: ISessionCapabilityObject = {
          allowedActions: ['encrypt', 'decrypt'],
          maxOperations: 100,
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        const walletSigProps: GetWalletSigProps = {
          chain: request.chain,
          sessionCapabilityObject,
          expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          sessionKey: {
            publicKey: '',
            secretKey: ''
          },
          sessionKeyUri: '',
          nonce: Math.random().toString(36).substring(7)
        };

        request.authSig = await this.client.getWalletSig(walletSigProps);
      }

      // Save encryption key with access control conditions
      const encryptParams: EncryptSdkParams = {
        accessControlConditions: request.accessControlConditions as any,
        authSig: request.authSig,
        permanent: request.permanent
      };

      const response = await this.client.encrypt(encryptParams);

      logger.info('Encryption key saved successfully', {
        chain: request.chain,
        conditions: request.accessControlConditions.length
      });

      return {
        encryptedSymmetricKey: response.ciphertext,
        symmetricKey: response.key
      };
    } catch (error) {
      logger.error('Failed to save encryption key', { error });
      throw this.wrapError(error, 'SAVE_KEY_FAILED');
    }
  }

  /**
   * Get encryption key if access conditions are met
   */
  public async getEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse> {
    try {
      await this.ensureInitialized();

      // Validate request
      this.validateRequest(request);

      // Generate auth signature if not provided
      if (!request.authSig) {
        const sessionCapabilityObject: ISessionCapabilityObject = {
          allowedActions: ['encrypt', 'decrypt'],
          maxOperations: 100,
          validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        };

        const walletSigProps: GetWalletSigProps = {
          chain: request.chain,
          sessionCapabilityObject,
          expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          sessionKey: {
            publicKey: '',
            secretKey: ''
          },
          sessionKeyUri: '',
          nonce: Math.random().toString(36).substring(7)
        };

        request.authSig = await this.client.getWalletSig(walletSigProps);
      }

      // Get encryption key if access conditions are met
      const decryptParams: DecryptRequest = {
        accessControlConditions: request.accessControlConditions as any,
        authSig: request.authSig,
        ciphertext: request.encryptedSymmetricKey
      };

      const response = await this.client.decrypt(decryptParams);

      logger.info('Encryption key retrieved successfully', {
        chain: request.chain,
        conditions: request.accessControlConditions.length
      });

      return {
        encryptedSymmetricKey: response.decryptedData,
        symmetricKey: response.key
      };
    } catch (error) {
      logger.error('Failed to get encryption key', { error });
      throw this.wrapError(error, 'GET_KEY_FAILED');
    }
  }

  /**
   * Create access control conditions for KYC data
   */
  public createKycAccessConditions(userId: string, projectId: string): AccessControlCondition[] {
    // Example conditions:
    // 1. User must own the data (userId match)
    // 2. Project must be active and authorized
    // 3. Request must be within allowed time window
    return [
      {
        contractAddress: config.blockchain.easContractAddress,
        standardContractType: 'ERC1155',
        chain: 'base',
        method: 'balanceOf',
        parameters: [':userAddress', userId],
        returnValueTest: {
          comparator: '>',
          value: '0'
        }
      },
      {
        contractAddress: config.blockchain.easContractAddress,
        standardContractType: 'ERC1155',
        chain: 'base',
        method: 'isProjectAuthorized',
        parameters: [projectId],
        returnValueTest: {
          comparator: '=',
          value: 'true'
        }
      }
    ];
  }

  /**
   * Disconnect from Lit Protocol network
   */
  public async disconnect(): Promise<void> {
    if (this.isInitialized) {
      await this.client.disconnect();
      this.isInitialized = false;
      logger.info('Disconnected from Lit Protocol network');
    }
  }

  // ===== Private Helper Methods =====

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private validateRequest(request: EncryptionKeyRequest): void {
    if (!request.accessControlConditions?.length) {
      throw new Error('Access control conditions are required');
    }
    if (!request.chain) {
      throw new Error('Chain is required');
    }
  }

  private wrapError(error: any, code: string): LitError {
    const litError: LitError = new Error(
      error?.message || 'An error occurred with Lit Protocol'
    ) as LitError;
    litError.code = code;
    litError.details = error;
    return litError;
  }
} 
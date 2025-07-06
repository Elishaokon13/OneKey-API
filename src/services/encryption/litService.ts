// OneKey KYC API - Lit Protocol Service
// Handles access control and key sharing for encrypted data

import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { LIT_NETWORKS } from '@lit-protocol/constants';
import {
  LitNodeClientConfig,
  GetWalletSigProps,
  EncryptSdkParams,
  DecryptRequest,
  ISessionCapabilityObject,
  AccessControlConditions,
  Chain,
  LitAbility,
  LitResourcePrefix
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
import { AnalyticsService } from '@/services/analytics/analyticsService';
import { CostMetric } from '@/types/analytics';
import { LitCostEstimator } from '@/utils/litCostEstimator';

class LitAccessControlConditionResource {
  readonly resourcePrefix: LitResourcePrefix = 'lit-accesscontrolcondition';
  readonly resource: string;

  constructor(resource: string) {
    this.resource = resource;
  }

  getResourceKey(): string {
    return `${this.resourcePrefix}:${this.resource}`;
  }

  isValidLitAbility(litAbility: LitAbility): boolean {
    return litAbility === 'access-control-condition-decryption' || litAbility === 'access-control-condition-signing';
  }

  toString(): string {
    return this.getResourceKey();
  }
}

export class LitService {
  private client!: LitNodeClient;
  private isInitialized: boolean = false;
  private readonly config: LitConfig;
  private readonly analyticsService?: AnalyticsService;

  constructor(litConfig?: Partial<LitConfig>, analyticsService?: AnalyticsService) {
    this.config = {
      network: (litConfig?.network || config.storage.litProtocolNetwork) as LitNetwork,
      debug: litConfig?.debug || false,
      minNodeCount: litConfig?.minNodeCount || 10,
      maxNodeCount: litConfig?.maxNodeCount || 15,
      bootstrapUrls: litConfig?.bootstrapUrls || [],
      fallbackBootstrapUrls: litConfig?.fallbackBootstrapUrls || []
    };
    this.analyticsService = analyticsService;
  }

  /**
   * Track operation cost
   */
  private async trackOperationCost(
    projectId: string,
    operation: string,
    conditions: AccessControlCondition[],
    success: boolean,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    if (!this.analyticsService) {
      return;
    }

    try {
      const cost = operation === 'saveEncryptionKey'
        ? LitCostEstimator.estimateSaveKeyCost(conditions)
        : LitCostEstimator.estimateGetKeyCost(conditions);

      const costBreakdown = LitCostEstimator.getCostBreakdown(
        operation === 'saveEncryptionKey' ? 'save' : 'get',
        conditions
      );

      const costMetric: Omit<CostMetric, 'timestamp'> = {
        projectId,
        operation,
        cost: Number(cost),
        network: this.config.network,
        success,
        metadata: {
          ...metadata,
          costBreakdown: costBreakdown.formatted
        }
      };

      await this.analyticsService.trackCost(costMetric);
    } catch (error) {
      logger.error('Failed to track operation cost', { error, operation, projectId });
    }
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
        litNetwork: this.config.network,
        debug: this.config.debug || false,
        minNodeCount: this.config.minNodeCount || 10
      };

      this.client = new LitNodeClient(clientConfig);
      await this.client.connect();
      this.isInitialized = true;

      logger.info('Lit Protocol service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Lit Protocol service', { error });
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Save encryption key with access control conditions
   */
  public async saveEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse> {
    const startTime = Date.now();
    
    try {
      await this.ensureInitialized();
      this.validateRequest(request);

      // Generate auth signature if not provided
      if (!request.authSig) {
        const sessionCapabilityObject = new (class implements ISessionCapabilityObject {
          private _attenuations: any = {};
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
        })();

        const resource = new LitAccessControlConditionResource('*');
        sessionCapabilityObject.addCapabilityForResource(resource, 'access-control-condition-signing');

        const walletSigProps: GetWalletSigProps = {
          chain: request.chain as Chain,
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
        accessControlConditions: request.accessControlConditions as unknown as AccessControlConditions,
        dataToEncrypt: new Uint8Array(Buffer.from(request.encryptedSymmetricKey || '', 'utf8'))
      };

      const response = await this.client.encrypt(encryptParams);

      // Track successful operation cost
      await this.trackOperationCost(
        request.projectId,
        'saveEncryptionKey',
        request.accessControlConditions,
        true,
        {
          chain: request.chain,
          duration: Date.now() - startTime
        }
      );

      logger.info('Encryption key saved successfully', {
        chain: request.chain,
        conditions: request.accessControlConditions.length
      });

      return {
        encryptedSymmetricKey: response.ciphertext,
        symmetricKey: new Uint8Array(Buffer.from(response.ciphertext, 'base64'))
      };
    } catch (error) {
      logger.error('Failed to save encryption key', { error });
      
      // Track failed operation cost
      await this.trackOperationCost(
        request.projectId,
        'saveEncryptionKey',
        request.accessControlConditions,
        false,
        {
          error: error?.message,
          chain: request.chain,
          duration: Date.now() - startTime
        }
      );

      const litError = new Error(error?.message || 'Unknown error') as LitError;
      litError.code = 'SAVE_KEY_FAILED';
      litError.details = error;
      throw litError;
    }
  }

  /**
   * Get encryption key if access conditions are met
   */
  public async getEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse> {
    const startTime = Date.now();

    try {
      await this.ensureInitialized();
      this.validateRequest(request);

      // Generate auth signature if not provided
      if (!request.authSig) {
        const sessionCapabilityObject = new (class implements ISessionCapabilityObject {
          private _attenuations: any = {};
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
        })();

        const resource = new LitAccessControlConditionResource('*');
        sessionCapabilityObject.addCapabilityForResource(resource, 'access-control-condition-decryption');

        const walletSigProps: GetWalletSigProps = {
          chain: request.chain as Chain,
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
        accessControlConditions: request.accessControlConditions as unknown as AccessControlConditions,
        chain: request.chain as Chain,
        ciphertext: request.encryptedSymmetricKey!,
        dataToEncryptHash: Buffer.from('').toString('hex')
      };

      const response = await this.client.decrypt(decryptParams);

      // Track successful operation cost
      await this.trackOperationCost(
        request.projectId,
        'getEncryptionKey',
        request.accessControlConditions,
        true,
        {
          chain: request.chain,
          duration: Date.now() - startTime
        }
      );

      return {
        encryptedSymmetricKey: response.decryptedData,
        symmetricKey: response.decryptedSymmetricKey
      };
    } catch (error) {
      logger.error('Failed to get encryption key', { error });

      // Track failed operation cost
      await this.trackOperationCost(
        request.projectId,
        'getEncryptionKey',
        request.accessControlConditions,
        false,
        {
          error: error?.message,
          chain: request.chain,
          duration: Date.now() - startTime
        }
      );

      const litError = new Error(error?.message || 'Unknown error') as LitError;
      litError.code = 'GET_KEY_FAILED';
      litError.details = error;
      throw litError;
    }
  }

  /**
   * Create access control conditions for KYC verification
   */
  public createKycAccessConditions(userId: string, projectId: string): AccessControlCondition[] {
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
        parameters: [':userAddress', projectId],
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

  /**
   * Ensure client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Validate encryption key request
   */
  private validateRequest(request: EncryptionKeyRequest): void {
    if (!request.accessControlConditions || request.accessControlConditions.length === 0) {
      throw new Error('Access control conditions are required');
    }

    if (!request.chain) {
      throw new Error('Chain is required');
    }
  }
} 
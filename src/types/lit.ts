// OneKey KYC API - Lit Protocol Types
import { LIT_NETWORKS } from '@lit-protocol/constants';
import { 
  ISessionCapabilityObject,
  GetWalletSigProps,
  EncryptSdkParams,
  DecryptRequest,
  AccessControlConditions
} from '@lit-protocol/types';

export type LitNetwork = keyof typeof LIT_NETWORKS;

export interface LitConfig {
  network: LitNetwork;
  debug?: boolean;
  minNodeCount?: number;
  maxNodeCount?: number;
  bootstrapUrls: string[];
  fallbackBootstrapUrls: string[];
}

export type AccessControlCondition = {
  contractAddress: string;
  standardContractType: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
};

export interface EncryptionKeyRequest {
  projectId: string; // Added for analytics tracking
  accessControlConditions: AccessControlCondition[];
  chain: string;
  authSig?: any; // Will be typed by SDK's AuthSig
  permanent?: boolean;
  encryptedSymmetricKey?: string;
}

export interface EncryptionKeyResponse {
  encryptedSymmetricKey: string;
  symmetricKey?: Uint8Array;
}

export interface LitError extends Error {
  code: string;
  details?: any;
}

// Re-export SDK types
export { ISessionCapabilityObject, GetWalletSigProps, EncryptSdkParams, DecryptRequest };

// Import the actual LitNodeClient type from the package
import { LitNodeClient as ActualLitNodeClient } from '@lit-protocol/lit-node-client';

// Re-export the type
export type LitNodeClient = ActualLitNodeClient; 
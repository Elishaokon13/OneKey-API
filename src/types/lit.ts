// OneKey KYC API - Lit Protocol Types

export enum LitNetwork {
  Cayenne = 'cayenne',
  Manzano = 'manzano',
  Habanero = 'habanero'
}

export interface LitConfig {
  network: LitNetwork;
  debug?: boolean;
  minNodeCount?: number;
  maxNodeCount?: number;
  bootstrapUrls?: string[];
  fallbackBootstrapUrls?: string[];
}

export interface AccessControlCondition {
  contractAddress: string;
  standardContractType: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

export interface EncryptionKeyRequest {
  accessControlConditions: AccessControlCondition[];
  chain: string;
  authSig?: any;
  permanent?: boolean;
}

export interface EncryptionKeyResponse {
  encryptedSymmetricKey: string;
  symmetricKey?: Uint8Array;
}

export interface LitError extends Error {
  code: string;
  details?: any;
}

// Import the actual LitNodeClient type from the package
import { LitNodeClient as ActualLitNodeClient } from '@lit-protocol/lit-node-client';

// Re-export the type
export type LitNodeClient = ActualLitNodeClient; 
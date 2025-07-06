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

export interface LitNodeClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  saveEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse>;
  getEncryptionKey(request: EncryptionKeyRequest): Promise<EncryptionKeyResponse>;
  generateAuthSig(): Promise<any>;
} 
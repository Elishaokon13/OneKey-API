// OneKey KYC API - Arweave Storage Types
// Basic interfaces for permanent decentralized storage

export interface ArweaveConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
  timeout: number;
  logging: boolean;
  gatewayUrls: string[];
  defaultGateway: string;
  wallet: {
    keyFile?: string;
    keyData?: any;
    address?: string;
    privateKey?: string;
  };
  bundling: {
    enabled: boolean;
    maxBundleSize: number;
    maxItems: number;
  };
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    backoffMultiplier: number;
  };
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export interface ArweaveStorageRequest {
  data: string | Buffer;
  contentType: string;
  tags: ArweaveTag[];
  metadata?: ArweaveMetadata;
  encrypt?: boolean;
  permanent?: boolean;
}

export interface ArweaveStorageResponse {
  transactionId: string;
  dataSize: number;
  cost: string;
  permanent: boolean;
  tags: ArweaveTag[];
  metadata: ArweaveMetadata;
  uploadTimestamp: string;
  confirmationStatus: 'pending' | 'confirmed' | 'failed';
  estimatedConfirmationTime: number;
  arweaveUrl: string;
  gatewayUrls: string[];
}

export interface ArweaveRetrievalRequest {
  transactionId: string;
  decrypt?: boolean;
  verifyIntegrity?: boolean;
  preferredGateway?: string;
}

export interface ArweaveRetrievalResponse {
  transactionId: string;
  data: string | Buffer;
  contentType: string;
  tags: ArweaveTag[];
  metadata: ArweaveMetadata;
  size: number;
  retrievalTimestamp: string;
  dataHash: string;
  verified: boolean;
  fromCache: boolean;
}

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveMetadata {
  uploadedBy: string;
  uploadTimestamp: string;
  originalFileName?: string;
  encryptionMethod?: 'AES-256-GCM' | 'ChaCha20-Poly1305';
  compressed?: boolean;
  dataHash: string;
  description?: string;
  category: 'kyc_document' | 'attestation_metadata' | 'audit_log' | 'backup' | 'other';
  relatedTransactions?: string[];
  expirationDate?: string;
}

export interface ArweaveNetworkInfo {
  network: string;
  version: number;
  release: number;
  height: number;
  current: string;
  blocks: number;
  peers: number;
  queue_length: number;
  node_state_latency: number;
}

export interface ArweaveHealthStatus {
  connected: boolean;
  networkInfo: ArweaveNetworkInfo;
  walletBalance: string;
  walletAddress: string;
  nodeVersion: string;
  lastBlockTime: string;
  syncStatus: 'synced' | 'syncing' | 'error';
  gatewayStatus: Record<string, boolean>;
  averageUploadTime: number;
  averageRetrievalTime: number;
  totalTransactions: number;
  failureRate: number;
  lastHealthCheck: string;
}

export interface ArweaveUsageStats {
  totalUploads: number;
  totalRetrievals: number;
  totalDataStored: number;
  totalCost: string;
  averageUploadTime: number;
  averageRetrievalTime: number;
  successRate: number;
  storageByCategory: Record<ArweaveMetadata['category'], number>;
  monthlyUsage: {
    month: string;
    uploads: number;
    retrievals: number;
    dataStored: number;
    cost: string;
  }[];
}

export interface AttestationArweaveStorage {
  attestationId: string;
  metadataTransactionId: string;
  documentsTransactionIds: string[];
  backupTransactionId?: string;
  storageTimestamp: string;
  permanent: boolean;
  totalCost: string;
  retrievalCount: number;
  lastRetrieved?: string;
}

export interface KycArweaveStorage {
  sessionId: string;
  encryptedDataTransactionId: string;
  documentTransactionIds: string[];
  auditLogTransactionId?: string;
  storageTimestamp: string;
  expirationDate?: string;
  accessCount: number;
  lastAccessed?: string;
}

// Error Classes
export class ArweaveError extends Error {
  constructor(
    message: string,
    public code: string,
    public transactionId?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ArweaveError';
  }
}

export class ArweaveUploadError extends ArweaveError {
  constructor(message: string, public dataSize?: number, public cost?: string, details?: Record<string, any>) {
    super(message, 'UPLOAD_FAILED', undefined, details);
    this.name = 'ArweaveUploadError';
  }
}

export class ArweaveRetrievalError extends ArweaveError {
  constructor(message: string, public transactionId: string, public gateway?: string, details?: Record<string, any>) {
    super(message, 'RETRIEVAL_FAILED', transactionId, details);
    this.name = 'ArweaveRetrievalError';
  }
}

export class ArweaveWalletError extends ArweaveError {
  constructor(message: string, public walletAddress?: string, details?: Record<string, any>) {
    super(message, 'WALLET_ERROR', undefined, details);
    this.name = 'ArweaveWalletError';
  }
}

// API Response Types
export interface ArweaveApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
  processingTime: number;
}

export interface ArweaveUploadApiResponse extends ArweaveApiResponse<ArweaveStorageResponse> {}
export interface ArweaveRetrievalApiResponse extends ArweaveApiResponse<ArweaveRetrievalResponse> {}
export interface ArweaveHealthApiResponse extends ArweaveApiResponse<ArweaveHealthStatus> {}
export interface ArweaveStatsApiResponse extends ArweaveApiResponse<ArweaveUsageStats> {}
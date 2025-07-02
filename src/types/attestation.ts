// OneKey KYC API - EAS Attestation Types
// Ethereum Attestation Service integration for KYC verification proofs

import { KycVerificationResult, KycProvider } from './kyc';

// ===== Core Attestation Interfaces =====

export interface AttestationData {
  // Core KYC Information
  kycProvider: KycProvider;
  kycSessionId: string;
  verificationStatus: 'verified' | 'failed' | 'pending' | 'expired';
  verificationTimestamp: number;
  confidenceScore: number; // 0-100
  
  // User Identity (Zero-PII)
  userIdHash: string; // Hashed user ID
  countryCode?: string;
  documentType?: string;
  
  // Verification Checks
  documentVerified: boolean;
  biometricVerified: boolean;
  livenessVerified: boolean;
  addressVerified: boolean;
  sanctionsCleared: boolean;
  pepCleared: boolean;
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  
  // Attestation Metadata
  schemaVersion: string;
  apiVersion: string;
  attestationStandard: string; // e.g., "OneKey-KYC-v1.0"
}

export interface CreateAttestationRequest {
  // Recipient of the attestation
  recipient: string; // Ethereum address
  
  // KYC verification data
  kycResult: KycVerificationResult;
  
  // Attestation options
  options?: {
    revocable?: boolean;
    expirationTime?: number;
    onChainMetadata?: Record<string, any>;
    offChainMetadata?: Record<string, any>;
  };
  
  // Request metadata
  requestId?: string;
  timestamp?: number;
  ipAddress?: string;
  userAgent?: string;
}

export interface EasAttestation {
  id: string; // OneKey internal ID
  uid: string; // EAS attestation UID on blockchain
  schemaId: string;
  attester: string; // OneKey's attester address
  recipient: string; // User's wallet address
  
  // Attestation content
  data: AttestationData;
  encodedData: string; // ABI-encoded data for on-chain storage
  
  // Blockchain information
  transactionHash: string;
  blockNumber: number;
  blockTimestamp: number;
  chainId: number;
  
  // Status
  status: AttestationStatus;
  revoked: boolean;
  revokedAt?: number;
  revokedBy?: string;
  revokedReason?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  metadata: Record<string, any>;
}

export interface AttestationVerificationResult {
  valid: boolean;
  attestation?: EasAttestation;
  verification: {
    onChain: boolean;
    schemaValid: boolean;
    notRevoked: boolean;
    notExpired: boolean;
    attesterValid: boolean;
    recipientMatch: boolean;
  };
  details: {
    checkedAt: string;
    blockNumber: number;
    gasUsed?: number;
    verificationTime: number;
  };
  errors?: string[];
}

// ===== Schema Definition =====

export interface AttestationSchema {
  id: string; // Schema UID on EAS
  name: string;
  description: string;
  version: string;
  schema: string; // ABI schema definition
  resolver?: string; // Custom resolver contract
  revocable: boolean;
  
  // Schema fields definition
  fields: AttestationSchemaField[];
  
  // Metadata
  createdAt: string;
  creator: string;
  registrationTransaction: string;
}

export interface AttestationSchemaField {
  name: string;
  type: 'uint256' | 'int256' | 'bool' | 'string' | 'bytes' | 'address' | 'bytes32';
  description: string;
  required: boolean;
  indexed?: boolean;
}

// ===== Request/Response Types =====

export interface CreateAttestationResponse {
  success: boolean;
  data?: {
    attestation: EasAttestation;
    transactionHash: string;
    gasUsed: number;
    cost: {
      gasPrice: string;
      gasLimit: number;
      totalCost: string; // in ETH
    };
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
}

export interface GetAttestationResponse {
  success: boolean;
  data?: EasAttestation;
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
  timestamp: string;
}

export interface AttestationListResponse {
  success: boolean;
  data?: {
    attestations: EasAttestation[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
  error?: {
    code: string;
    message: string;
  };
  requestId: string;
  timestamp: string;
}

export interface RevokeAttestationRequest {
  uid: string; // Attestation UID to revoke
  reason?: string;
  metadata?: Record<string, any>;
}

export interface VerifyAttestationRequest {
  uid?: string; // Attestation UID
  recipient?: string; // Verify all attestations for recipient
  schemaId?: string; // Filter by schema
  includeRevoked?: boolean;
  includeExpired?: boolean;
}

// ===== Configuration & Settings =====

export interface EasConfig {
  // Network configuration
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  schemaRegistryAddress: string;
  
  // OneKey configuration
  attesterPrivateKey: string;
  attesterAddress: string;
  defaultSchemaId: string;
  
  // Gas configuration
  gasLimit: number;
  gasPrice?: string;
  gasPriceStrategy: 'fixed' | 'estimate' | 'fast' | 'standard' | 'slow';
  
  // Features
  enableRevocation: boolean;
  defaultExpirationHours: number;
  autoCreateOnKyc: boolean;
  
  // Rate limiting
  maxAttestationsPerHour: number;
  maxAttestationsPerDay: number;
}

// ===== Error Classes =====

export class AttestationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AttestationError';
  }
}

export class AttestationCreationError extends AttestationError {
  constructor(
    message: string,
    public transactionHash?: string,
    public gasUsed?: number,
    details?: Record<string, any>
  ) {
    super(message, 'ATTESTATION_CREATION_FAILED', details);
    this.name = 'AttestationCreationError';
  }
}

export class AttestationVerificationError extends AttestationError {
  constructor(
    message: string,
    public uid?: string,
    details?: Record<string, any>
  ) {
    super(message, 'ATTESTATION_VERIFICATION_FAILED', details);
    this.name = 'AttestationVerificationError';
  }
}

export class AttestationNotFoundError extends AttestationError {
  constructor(uid: string) {
    super(`Attestation not found: ${uid}`, 'ATTESTATION_NOT_FOUND', { uid });
    this.name = 'AttestationNotFoundError';
  }
}

export class SchemaError extends AttestationError {
  constructor(
    message: string,
    public schemaId?: string,
    details?: Record<string, any>
  ) {
    super(message, 'SCHEMA_ERROR', details);
    this.name = 'SchemaError';
  }
}

export class BlockchainError extends AttestationError {
  constructor(
    message: string,
    public chainId?: number,
    public blockNumber?: number,
    details?: Record<string, any>
  ) {
    super(message, 'BLOCKCHAIN_ERROR', details);
    this.name = 'BlockchainError';
  }
}

// ===== Enums =====

export type AttestationStatus = 
  | 'pending'      // Attestation submitted to blockchain
  | 'confirmed'    // Attestation confirmed on blockchain
  | 'failed'       // Attestation creation failed
  | 'revoked'      // Attestation has been revoked
  | 'expired';     // Attestation has expired

export type ChainId = 
  | 1      // Ethereum Mainnet
  | 5      // Goerli Testnet
  | 11155111 // Sepolia Testnet
  | 8453   // Base Mainnet
  | 84532  // Base Sepolia Testnet
  | 10     // Optimism Mainnet
  | 420;   // Optimism Goerli Testnet

// ===== Utility Types =====

export interface GasEstimate {
  gasLimit: number;
  gasPrice: string;
  totalCost: string;
  estimatedConfirmationTime: number; // seconds
}

export interface AttestationStats {
  totalAttestations: number;
  verifiedAttestations: number;
  revokedAttestations: number;
  expiredAttestations: number;
  successRate: number;
  averageConfidenceScore: number;
  providerStats: Record<KycProvider, {
    count: number;
    successRate: number;
    averageScore: number;
  }>;
  timeRange: {
    from: string;
    to: string;
  };
}

export interface AttestationActivity {
  type: 'created' | 'verified' | 'revoked' | 'expired';
  attestationUid: string;
  timestamp: string;
  actor: string; // Address who performed the action
  metadata?: Record<string, any>;
}

// ===== API Response Helpers =====

export type AttestationApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
  blockchain?: {
    chainId: number;
    blockNumber: number;
    gasUsed?: number;
    transactionHash?: string;
  };
}; 
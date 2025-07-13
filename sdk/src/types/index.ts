// OneKey SDK Types
// Comprehensive type definitions for the OneKey KYC API SDK

// ===== Core Configuration =====

export interface OneKeyConfig {
  apiKey?: string;
  environment: 'production' | 'sandbox';
  baseUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
  debug?: boolean;
  retry?: {
    attempts: number;
    delay: number;
    backoff: 'linear' | 'exponential';
  };
}

// ===== API Response Types =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
}

// ===== KYC Types =====

export type KycProvider = 'smile_identity' | 'onfido' | 'trulioo';
export type KycStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
export type DocumentType = 'passport' | 'national_id' | 'drivers_license';

export interface KycUser {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
}

export interface CreateKycSessionRequest {
  user: KycUser;
  documentType: DocumentType;
  country: string;
  provider?: KycProvider;
  callbackUrl?: string;
}

export interface KycSession {
  sessionId: string;
  status: KycStatus;
  provider: KycProvider;
  user: KycUser;
  integration: {
    verificationUrl: string;
    sdkToken: string;
  };
  timestamps: {
    createdAt: string;
    expiresAt: string;
  };
}

export interface KycDocument {
  documentId: string;
  sessionId: string;
  documentType: DocumentType;
  filename?: string;
  mimeType?: string;
  side?: 'front' | 'back';
  status: 'uploaded' | 'processing' | 'processed' | 'failed';
  metadata?: Record<string, any>;
  uploadedAt: string;
  processedAt?: string;
}

export interface KycWebhookEvent {
  event: 'session.created' | 'session.updated' | 'session.completed' | 'session.failed' | 
         'document.uploaded' | 'document.processed' | 'verification.completed';
  data: any;
  timestamp: string;
  signature?: string;
}

// ===== Attestation Types =====

export interface Attestation {
  id: string;
  uid: string;
  recipient: string;
  transactionHash: string;
  status: 'confirmed' | 'pending' | 'failed';
  createdAt: string;
}

export interface AttestationSchema {
  id: string;
  name: string;
  description?: string;
  schema: string;
  resolver?: string;
  revocable: boolean;
  createdAt: string;
}

export interface AttestationRecord {
  id: string;
  uid: string;
  schemaId: string;
  recipient: string;
  attester: string;
  data: Record<string, any>;
  revocable: boolean;
  revoked: boolean;
  revokedAt?: string;
  expirationTime?: number;
  transactionHash?: string;
  blockNumber?: number;
  createdAt: string;
  metadata?: Record<string, any>;
}

// ===== Crypto Types =====

export interface CryptoProvider {
  id: string;
  name: string;
  type: 'symmetric' | 'asymmetric';
  algorithms: string[];
  keySize: number;
  enabled: boolean;
}

// ===== Error Types =====

export class OneKeyError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'OneKeyError';
  }
}

export class ApiError extends OneKeyError {
  constructor(
    message: string,
    public status: number,
    code: string,
    details?: Record<string, any>
  ) {
    super(code, message, details);
    this.name = 'ApiError';
  }
}

export class NetworkError extends OneKeyError {
  constructor(
    message: string,
    details?: Record<string, any>
  ) {
    super('NETWORK_ERROR', message, details);
    this.name = 'NetworkError';
  }
}

export class AuthenticationError extends OneKeyError {
  constructor(
    message: string,
    details?: Record<string, any>
  ) {
    super('AUTHENTICATION_FAILED', message, details);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends OneKeyError {
  constructor(
    message: string,
    details?: Record<string, any>
  ) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
} 
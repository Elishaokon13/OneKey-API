// OneKey SDK Types
// Comprehensive type definitions for the OneKey KYC API SDK

// ===== Core Configuration =====

export interface OneKeyConfig {
  apiKey: string;
  environment?: 'production' | 'sandbox';
  baseUrl?: string;
  timeout?: number;
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

// ===== Attestation Types =====

export interface Attestation {
  id: string;
  uid: string;
  recipient: string;
  transactionHash: string;
  status: 'confirmed' | 'pending' | 'failed';
  createdAt: string;
}

// ===== Error Types =====

export class OneKeyError extends Error {
  constructor(
    message: string,
    public code: string,
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
    super(message, code, details);
    this.name = 'ApiError';
  }
} 
export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  passkey_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  wallet_address?: string | undefined;
  passkey_id?: string | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface WalletLoginRequest {
  wallet_address: string;
  signature: string;
  message: string;
  nonce: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'Bearer';
}

export interface JWTPayload {
  user_id: string;
  email: string;
  wallet_address?: string | undefined;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface AuthResponse {
  user: Omit<User, 'metadata'>;
  tokens: AuthTokens;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

// Authentication middleware types
export interface AuthenticatedRequest extends Request {
  user: User;
  token: string;
}

export interface AuthContext {
  user: User;
  token: string;
  isAuthenticated: boolean;
}

// Privy integration types
export interface PrivyUser {
  id: string;
  did: string;
  wallet_address?: string;
  email?: string;
  phone?: string;
  created_at: string;
}

export interface PrivyAuthResult {
  user: PrivyUser;
  session_token: string;
  access_token: string;
}

// API Key authentication types
export interface ApiKey {
  id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  created_by: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  usage_count: number;
  rate_limit_override?: Record<string, number>;
  metadata: Record<string, any>;
}

export interface CreateApiKeyRequest {
  name: string;
  permissions: string[];
  expires_at?: string;
  rate_limit_override?: Record<string, number>;
  metadata?: Record<string, any>;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  api_key: string; // Only returned on creation
  permissions: string[];
  expires_at?: string;
  created_at: string;
}

// Error types for authentication
export class AuthenticationError extends Error {
  constructor(message: string, public code: string = 'AUTH_ERROR') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public code: string = 'AUTHZ_ERROR') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TokenExpiredError extends Error {
  constructor(message: string = 'Token has expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends Error {
  constructor(message: string = 'Invalid token provided') {
    super(message);
    this.name = 'InvalidTokenError';
  }
} 
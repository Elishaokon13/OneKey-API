export interface PrivyUser {
  id: string;
  did: string;
  createdAt: string;
  linkedAccounts: PrivyLinkedAccount[];
  customMetadata?: Record<string, any>;
}

export interface PrivyLinkedAccount {
  type: 'wallet' | 'email' | 'phone' | 'google' | 'twitter' | 'discord' | 'github' | 'linkedin' | 'apple' | 'farcaster';
  address?: string; // For wallet accounts
  email?: string; // For email accounts
  phoneNumber?: string; // For phone accounts
  username?: string; // For social accounts
  subject?: string; // For OAuth accounts
  verified?: boolean;
  firstVerifiedAt?: string;
  latestVerifiedAt?: string;
  walletClient?: string;
  walletClientType?: string;
  chainId?: string;
  chainType?: 'ethereum' | 'solana';
  connectorType?: string;
  recoveryMethod?: string;
  imported?: boolean;
  delegated?: boolean;
}

export interface PrivyAuthRequest {
  accessToken: string;
  idToken?: string;
  sessionToken?: string;
  clientSideVerification?: boolean;
  metadata?: Record<string, any>;
}

export interface PrivyAuthResult {
  user: PrivyUser;
  isNewUser: boolean;
  sessionClaims: PrivySessionClaims;
}

export interface PrivySessionClaims {
  userId: string;
  appId: string;
  issuedAt: number;
  expiresAt: number;
  sessionId: string;
}

export interface PrivyVerificationResult {
  userId: string;
  appId: string;
  sessionId: string;
  isValid: boolean;
  isExpired: boolean;
  user?: PrivyUser;
  error?: string;
}

export interface PrivyLoginRequest {
  accessToken: string;
  metadata?: Record<string, any>;
}

export interface PrivyLinkAccountRequest {
  userId: string;
  accountType: 'wallet' | 'email' | 'phone';
  accountData: {
    address?: string; // For wallet
    email?: string; // For email
    phoneNumber?: string; // For phone
    signature?: string; // For verification
    message?: string; // For verification
  };
}

export interface PrivyWalletData {
  address: string;
  chainType: 'ethereum' | 'solana';
  chainId?: string;
  walletClient?: string;
  connectorType?: string;
}

export interface PrivyEmailData {
  email: string;
  verified: boolean;
}

export interface PrivyPhoneData {
  phoneNumber: string;
  verified: boolean;
}

// Enhanced auth types that extend our existing auth system
export interface PrivyAuthContext {
  user: PrivyUser;
  sessionId: string;
  isValid: boolean;
  linkedWallets: PrivyWalletData[];
  linkedEmails: PrivyEmailData[];
  linkedPhones: PrivyPhoneData[];
}

export interface PrivyUserProfile {
  privyUserId: string;
  did: string;
  primaryWallet?: string;
  primaryEmail?: string;
  primaryPhone?: string;
  verificationLevel: 'unverified' | 'email' | 'wallet' | 'full';
  kycStatus?: 'pending' | 'approved' | 'rejected';
  attestations: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// Integration with our existing User type
export interface EnhancedUser {
  id: string; // Our internal user ID
  email: string;
  wallet_address?: string;
  passkey_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  metadata: Record<string, any>;
  // Privy integration fields
  privy_user_id?: string;
  privy_did?: string;
  privy_linked_accounts?: PrivyLinkedAccount[];
}

// Error types for Privy authentication
export class PrivyAuthenticationError extends Error {
  constructor(message: string, public code: string = 'PRIVY_AUTH_ERROR') {
    super(message);
    this.name = 'PrivyAuthenticationError';
  }
}

export class PrivyVerificationError extends Error {
  constructor(message: string, public code: string = 'PRIVY_VERIFICATION_ERROR') {
    super(message);
    this.name = 'PrivyVerificationError';
  }
}

export class PrivySessionError extends Error {
  constructor(message: string, public code: string = 'PRIVY_SESSION_ERROR') {
    super(message);
    this.name = 'PrivySessionError';
  }
}

// Configuration types
export interface PrivyConfig {
  appId: string;
  appSecret: string;
  verificationKey?: string;
  allowedOrigins?: string[];
  sessionDuration?: number;
  requireVerifiedEmail?: boolean;
  requireVerifiedWallet?: boolean;
}

// Event types for Privy webhooks
export interface PrivyWebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'account.linked' | 'account.unlinked';
  data: {
    user: PrivyUser;
    account?: PrivyLinkedAccount;
    metadata?: Record<string, any>;
  };
  timestamp: string;
  signature: string;
}

export interface PrivyWebhookVerification {
  isValid: boolean;
  timestamp: number;
  tolerance: number;
  expectedSignature: string;
  receivedSignature: string;
} 
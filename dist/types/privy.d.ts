export interface PrivyUser {
    id: string;
    did: string;
    createdAt: string;
    linkedAccounts: PrivyLinkedAccount[];
    customMetadata?: Record<string, any>;
}
export interface PrivyLinkedAccount {
    type: 'wallet' | 'email' | 'phone' | 'google' | 'twitter' | 'discord' | 'github' | 'linkedin' | 'apple' | 'farcaster';
    address?: string;
    email?: string;
    phoneNumber?: string;
    username?: string;
    subject?: string;
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
        address?: string;
        email?: string;
        phoneNumber?: string;
        signature?: string;
        message?: string;
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
export interface EnhancedUser {
    id: string;
    email: string;
    wallet_address?: string;
    passkey_id?: string;
    created_at: string;
    updated_at: string;
    last_login?: string;
    is_active: boolean;
    metadata: Record<string, any>;
    privy_user_id?: string;
    privy_did?: string;
    privy_linked_accounts?: PrivyLinkedAccount[];
}
export declare class PrivyAuthenticationError extends Error {
    code: string;
    constructor(message: string, code?: string);
}
export declare class PrivyVerificationError extends Error {
    code: string;
    constructor(message: string, code?: string);
}
export declare class PrivySessionError extends Error {
    code: string;
    constructor(message: string, code?: string);
}
export interface PrivyConfig {
    appId: string;
    appSecret: string;
    verificationKey?: string;
    allowedOrigins?: string[];
    sessionDuration?: number;
    requireVerifiedEmail?: boolean;
    requireVerifiedWallet?: boolean;
}
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
//# sourceMappingURL=privy.d.ts.map
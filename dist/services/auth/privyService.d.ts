import { PrivyUser, PrivyAuthRequest, PrivyVerificationResult, PrivyAuthContext } from '@/types/privy';
import { AuthResponse } from '@/types/auth';
export declare class PrivyService {
    private privy;
    private isInitialized;
    constructor();
    /**
     * Initialize Privy client
     */
    private initialize;
    /**
     * Check if Privy is properly configured and initialized
     */
    isConfigured(): boolean;
    /**
     * Verify Privy access token and get user information
     */
    verifyAccessToken(accessToken: string): Promise<PrivyVerificationResult>;
    /**
     * Authenticate user with Privy and integrate with our system
     */
    authenticateWithPrivy(authRequest: PrivyAuthRequest): Promise<AuthResponse>;
    /**
     * Get Privy authentication context for a verified user
     */
    getAuthContext(accessToken: string): Promise<PrivyAuthContext>;
    /**
     * Link additional account to existing Privy user
     */
    linkAccount(userId: string, accountType: string, accountData: any): Promise<void>;
    /**
     * Get user by Privy user ID
     */
    getUserByPrivyId(privyUserId: string): Promise<PrivyUser | null>;
    /**
     * Extract primary wallet address from Privy user
     */
    private extractPrimaryWallet;
    /**
     * Extract primary email from Privy user
     */
    private extractPrimaryEmail;
    /**
     * Extract wallet data from Privy user
     */
    private extractWalletData;
    /**
     * Extract email data from Privy user
     */
    private extractEmailData;
    /**
     * Extract phone data from Privy user
     */
    private extractPhoneData;
    /**
     * Find user by Privy user ID in our database
     */
    private findUserByPrivyId;
    /**
     * Create new user from Privy data
     */
    private createUserFromPrivy;
    /**
     * Update existing user with Privy data
     */
    private updateUserWithPrivyData;
    /**
     * Remove sensitive data from user object
     */
    private sanitizeUser;
    /**
     * Health check for Privy service
     */
    getHealthStatus(): {
        configured: boolean;
        initialized: boolean;
        appId: string | null;
    };
}
export declare const privyService: PrivyService;
//# sourceMappingURL=privyService.d.ts.map
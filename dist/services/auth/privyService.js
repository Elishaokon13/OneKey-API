"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.privyService = exports.PrivyService = void 0;
// import { PrivyApi } from '@privy-io/server-auth';
// TODO: Update import when we have correct Privy SDK export name
const environment_1 = require("../../config/environment");
const authService_1 = require("./authService");
const jwtService_1 = require("./jwtService");
const privy_1 = require("@/types/privy");
const uuid_1 = require("uuid");
class PrivyService {
    privy = null; // Placeholder until we get correct SDK
    isInitialized = false;
    constructor() {
        this.initialize();
    }
    /**
     * Initialize Privy client
     */
    initialize() {
        try {
            if (!environment_1.config.blockchain.privyAppId || !environment_1.config.blockchain.privyAppSecret) {
                console.warn('Privy credentials not configured. Privy integration will be disabled.');
                return;
            }
            // TODO: Initialize actual Privy SDK when import is fixed
            // this.privy = new PrivyApi({
            //   appId: config.blockchain.privyAppId,
            //   appSecret: config.blockchain.privyAppSecret,
            // });
            this.isInitialized = false; // Set to false until actual SDK is integrated
            console.log('⚠️ Privy service placeholder initialized (SDK integration pending)');
        }
        catch (error) {
            console.error('❌ Failed to initialize Privy service:', error);
            this.isInitialized = false;
        }
    }
    /**
     * Check if Privy is properly configured and initialized
     */
    isConfigured() {
        return this.isInitialized && this.privy !== null;
    }
    /**
     * Verify Privy access token and get user information
     */
    async verifyAccessToken(accessToken) {
        if (!this.isConfigured()) {
            throw new privy_1.PrivyVerificationError('Privy service not configured');
        }
        try {
            // TODO: Implement actual Privy SDK verification
            // const verificationResult = await this.privy!.verifyAuthToken(accessToken);
            // Placeholder implementation
            throw new privy_1.PrivyVerificationError('Privy SDK integration pending');
        }
        catch (error) {
            console.error('Privy token verification failed:', error);
            if (error instanceof Error && error.message.includes('expired')) {
                return {
                    userId: '',
                    appId: '',
                    sessionId: '',
                    isValid: false,
                    isExpired: true,
                    error: 'Token expired'
                };
            }
            throw new privy_1.PrivyVerificationError(`Token verification failed: ${error}`);
        }
    }
    /**
     * Authenticate user with Privy and integrate with our system
     */
    async authenticateWithPrivy(authRequest) {
        if (!this.isConfigured()) {
            throw new privy_1.PrivyAuthenticationError('Privy service not configured');
        }
        try {
            // Verify the Privy access token
            const verification = await this.verifyAccessToken(authRequest.accessToken);
            if (!verification.isValid || !verification.user) {
                throw new privy_1.PrivyAuthenticationError('Invalid Privy authentication');
            }
            const privyUser = verification.user;
            // Extract primary wallet and email from Privy user
            const primaryWallet = this.extractPrimaryWallet(privyUser);
            const primaryEmail = this.extractPrimaryEmail(privyUser);
            // Try to find existing user by Privy user ID first
            let existingUser = await this.findUserByPrivyId(privyUser.id);
            // If not found by Privy ID, try by wallet or email
            if (!existingUser) {
                if (primaryWallet) {
                    existingUser = await authService_1.authService.findUserByWalletAddress(primaryWallet);
                }
                else if (primaryEmail) {
                    existingUser = await authService_1.authService.findUserByEmail(primaryEmail);
                }
            }
            let user;
            if (existingUser) {
                // Update existing user with Privy information
                user = await this.updateUserWithPrivyData(existingUser, privyUser);
            }
            else {
                // Create new user with Privy data
                user = await this.createUserFromPrivy(privyUser);
            }
            // Generate our JWT tokens
            const tokens = jwtService_1.jwtService.generateTokens(user);
            return {
                user: this.sanitizeUser(user),
                tokens
            };
        }
        catch (error) {
            if (error instanceof privy_1.PrivyAuthenticationError || error instanceof privy_1.PrivyVerificationError) {
                throw error;
            }
            console.error('Privy authentication error:', error);
            throw new privy_1.PrivyAuthenticationError('Privy authentication failed');
        }
    }
    /**
     * Get Privy authentication context for a verified user
     */
    async getAuthContext(accessToken) {
        const verification = await this.verifyAccessToken(accessToken);
        if (!verification.isValid || !verification.user) {
            throw new privy_1.PrivySessionError('Invalid session');
        }
        const user = verification.user;
        return {
            user,
            sessionId: verification.sessionId,
            isValid: true,
            linkedWallets: this.extractWalletData(user),
            linkedEmails: this.extractEmailData(user),
            linkedPhones: this.extractPhoneData(user)
        };
    }
    /**
     * Link additional account to existing Privy user
     */
    async linkAccount(userId, accountType, accountData) {
        if (!this.isConfigured()) {
            throw new privy_1.PrivyAuthenticationError('Privy service not configured');
        }
        try {
            // This would typically involve calling Privy's link account API
            // For now, this is a placeholder since the exact API might vary
            console.log(`Linking ${accountType} account for user ${userId}:`, accountData);
            // TODO: Implement actual account linking with Privy SDK
            throw new Error('Account linking not yet implemented in Privy SDK');
        }
        catch (error) {
            console.error('Account linking failed:', error);
            throw new privy_1.PrivyAuthenticationError(`Failed to link ${accountType} account`);
        }
    }
    /**
     * Get user by Privy user ID
     */
    async getUserByPrivyId(privyUserId) {
        if (!this.isConfigured()) {
            return null;
        }
        try {
            // TODO: Implement actual Privy SDK user fetching
            // const user = await this.privy!.getUser(privyUserId);
            // return user as PrivyUser;
            console.log('Privy getUserByPrivyId placeholder called for:', privyUserId);
            return null;
        }
        catch (error) {
            console.error('Failed to get Privy user:', error);
            return null;
        }
    }
    /**
     * Extract primary wallet address from Privy user
     */
    extractPrimaryWallet(privyUser) {
        const walletAccounts = privyUser.linkedAccounts.filter(account => account.type === 'wallet' && account.address);
        // Return the first verified wallet, or just the first wallet if none are verified
        const verifiedWallet = walletAccounts.find(account => account.verified);
        return verifiedWallet?.address || walletAccounts[0]?.address || null;
    }
    /**
     * Extract primary email from Privy user
     */
    extractPrimaryEmail(privyUser) {
        const emailAccounts = privyUser.linkedAccounts.filter(account => account.type === 'email' && account.email);
        // Return the first verified email, or just the first email if none are verified
        const verifiedEmail = emailAccounts.find(account => account.verified);
        return verifiedEmail?.email || emailAccounts[0]?.email || null;
    }
    /**
     * Extract wallet data from Privy user
     */
    extractWalletData(privyUser) {
        return privyUser.linkedAccounts
            .filter(account => account.type === 'wallet' && account.address)
            .map(account => ({
            address: account.address,
            chainType: account.chainType || 'ethereum',
            chainId: account.chainId,
            walletClient: account.walletClient,
            connectorType: account.connectorType
        }));
    }
    /**
     * Extract email data from Privy user
     */
    extractEmailData(privyUser) {
        return privyUser.linkedAccounts
            .filter(account => account.type === 'email' && account.email)
            .map(account => ({
            email: account.email,
            verified: account.verified || false
        }));
    }
    /**
     * Extract phone data from Privy user
     */
    extractPhoneData(privyUser) {
        return privyUser.linkedAccounts
            .filter(account => account.type === 'phone' && account.phoneNumber)
            .map(account => ({
            phoneNumber: account.phoneNumber,
            verified: account.verified || false
        }));
    }
    /**
     * Find user by Privy user ID in our database
     */
    async findUserByPrivyId(privyUserId) {
        // This would query our database for users with this Privy ID
        // For now, returning null since we need to implement the database query
        return null;
    }
    /**
     * Create new user from Privy data
     */
    async createUserFromPrivy(privyUser) {
        const primaryWallet = this.extractPrimaryWallet(privyUser);
        const primaryEmail = this.extractPrimaryEmail(privyUser);
        if (!primaryEmail && !primaryWallet) {
            throw new privy_1.PrivyAuthenticationError('No usable email or wallet found in Privy account');
        }
        // Generate a temporary email if user only has wallet
        const email = primaryEmail || `${primaryWallet?.toLowerCase()}@wallet.onekey`;
        const tempPassword = (0, uuid_1.v4)(); // User won't use this password
        try {
            const authResponse = await authService_1.authService.register({
                email,
                password: tempPassword,
                wallet_address: primaryWallet || undefined,
                metadata: {
                    privy_user_id: privyUser.id,
                    privy_did: privyUser.did,
                    privy_linked_accounts: privyUser.linkedAccounts,
                    privy_registered: true,
                    creation_source: 'privy'
                }
            });
            return authResponse.user;
        }
        catch (error) {
            console.error('Failed to create user from Privy data:', error);
            throw new privy_1.PrivyAuthenticationError('Failed to create user account');
        }
    }
    /**
     * Update existing user with Privy data
     */
    async updateUserWithPrivyData(existingUser, privyUser) {
        // Update user metadata with Privy information
        const updatedMetadata = {
            ...existingUser.metadata,
            privy_user_id: privyUser.id,
            privy_did: privyUser.did,
            privy_linked_accounts: privyUser.linkedAccounts,
            privy_last_sync: new Date().toISOString()
        };
        // In a real implementation, we would update the user in the database
        // For now, return the user with updated metadata
        return {
            ...existingUser,
            metadata: updatedMetadata
        };
    }
    /**
     * Remove sensitive data from user object
     */
    sanitizeUser(user) {
        const { metadata, ...sanitizedUser } = user;
        return sanitizedUser;
    }
    /**
     * Health check for Privy service
     */
    getHealthStatus() {
        return {
            configured: !!environment_1.config.blockchain.privyAppId && !!environment_1.config.blockchain.privyAppSecret,
            initialized: this.isInitialized,
            appId: environment_1.config.blockchain.privyAppId ? environment_1.config.blockchain.privyAppId.substring(0, 8) + '...' : null
        };
    }
}
exports.PrivyService = PrivyService;
// Export singleton instance
exports.privyService = new PrivyService();
//# sourceMappingURL=privyService.js.map
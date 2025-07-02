// import { PrivyApi } from '@privy-io/server-auth';
// TODO: Update import when we have correct Privy SDK export name
import config from '@/config/environment';
import { authService } from './authService';
import { jwtService } from './jwtService';
import {
  PrivyUser,
  PrivyAuthRequest,
  PrivyAuthResult,
  PrivyVerificationResult,
  PrivyAuthContext,
  PrivyWalletData,
  PrivyEmailData,
  PrivyPhoneData,
  PrivyAuthenticationError,
  PrivyVerificationError,
  PrivySessionError,
  EnhancedUser
} from '@/types/privy';
import { User, AuthResponse, AuthTokens } from '@/types/auth';
import { v4 as uuidv4 } from 'uuid';

export class PrivyService {
  private privy: any = null; // Placeholder until we get correct SDK
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize Privy client
   */
  private initialize(): void {
    try {
      if (!config.blockchain.privyAppId || !config.blockchain.privyAppSecret) {
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
    } catch (error) {
      console.error('❌ Failed to initialize Privy service:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if Privy is properly configured and initialized
   */
  public isConfigured(): boolean {
    return this.isInitialized && this.privy !== null;
  }

  /**
   * Verify Privy access token and get user information
   */
  async verifyAccessToken(accessToken: string): Promise<PrivyVerificationResult> {
    if (!this.isConfigured()) {
      throw new PrivyVerificationError('Privy service not configured');
    }

    try {
      const verificationResult = await this.privy!.verifyAuthToken(accessToken);
      
      if (!verificationResult.userId) {
        throw new PrivyVerificationError('Invalid access token');
      }

      // Get user details from Privy
      const user = await this.privy!.getUser(verificationResult.userId);

      return {
        userId: verificationResult.userId,
        appId: verificationResult.appId,
        sessionId: verificationResult.sessionId || '',
        isValid: true,
        isExpired: false,
        user: user as PrivyUser
      };
    } catch (error) {
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

      throw new PrivyVerificationError(`Token verification failed: ${error}`);
    }
  }

  /**
   * Authenticate user with Privy and integrate with our system
   */
  async authenticateWithPrivy(authRequest: PrivyAuthRequest): Promise<AuthResponse> {
    if (!this.isConfigured()) {
      throw new PrivyAuthenticationError('Privy service not configured');
    }

    try {
      // Verify the Privy access token
      const verification = await this.verifyAccessToken(authRequest.accessToken);
      
      if (!verification.isValid || !verification.user) {
        throw new PrivyAuthenticationError('Invalid Privy authentication');
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
          existingUser = await authService.findUserByWalletAddress(primaryWallet);
        } else if (primaryEmail) {
          existingUser = await authService.findUserByEmail(primaryEmail);
        }
      }

      let user: User;

      if (existingUser) {
        // Update existing user with Privy information
        user = await this.updateUserWithPrivyData(existingUser, privyUser);
      } else {
        // Create new user with Privy data
        user = await this.createUserFromPrivy(privyUser);
      }

      // Generate our JWT tokens
      const tokens = jwtService.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      if (error instanceof PrivyAuthenticationError || error instanceof PrivyVerificationError) {
        throw error;
      }
      console.error('Privy authentication error:', error);
      throw new PrivyAuthenticationError('Privy authentication failed');
    }
  }

  /**
   * Get Privy authentication context for a verified user
   */
  async getAuthContext(accessToken: string): Promise<PrivyAuthContext> {
    const verification = await this.verifyAccessToken(accessToken);
    
    if (!verification.isValid || !verification.user) {
      throw new PrivySessionError('Invalid session');
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
  async linkAccount(userId: string, accountType: string, accountData: any): Promise<void> {
    if (!this.isConfigured()) {
      throw new PrivyAuthenticationError('Privy service not configured');
    }

    try {
      // This would typically involve calling Privy's link account API
      // For now, this is a placeholder since the exact API might vary
      console.log(`Linking ${accountType} account for user ${userId}:`, accountData);
      
      // TODO: Implement actual account linking with Privy SDK
      throw new Error('Account linking not yet implemented in Privy SDK');
    } catch (error) {
      console.error('Account linking failed:', error);
      throw new PrivyAuthenticationError(`Failed to link ${accountType} account`);
    }
  }

  /**
   * Get user by Privy user ID
   */
  async getUserByPrivyId(privyUserId: string): Promise<PrivyUser | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const user = await this.privy!.getUser(privyUserId);
      return user as PrivyUser;
    } catch (error) {
      console.error('Failed to get Privy user:', error);
      return null;
    }
  }

  /**
   * Extract primary wallet address from Privy user
   */
  private extractPrimaryWallet(privyUser: PrivyUser): string | null {
    const walletAccounts = privyUser.linkedAccounts.filter(
      account => account.type === 'wallet' && account.address
    );
    
    // Return the first verified wallet, or just the first wallet if none are verified
    const verifiedWallet = walletAccounts.find(account => account.verified);
    return verifiedWallet?.address || walletAccounts[0]?.address || null;
  }

  /**
   * Extract primary email from Privy user
   */
  private extractPrimaryEmail(privyUser: PrivyUser): string | null {
    const emailAccounts = privyUser.linkedAccounts.filter(
      account => account.type === 'email' && account.email
    );
    
    // Return the first verified email, or just the first email if none are verified
    const verifiedEmail = emailAccounts.find(account => account.verified);
    return verifiedEmail?.email || emailAccounts[0]?.email || null;
  }

  /**
   * Extract wallet data from Privy user
   */
  private extractWalletData(privyUser: PrivyUser): PrivyWalletData[] {
    return privyUser.linkedAccounts
      .filter(account => account.type === 'wallet' && account.address)
      .map(account => ({
        address: account.address!,
        chainType: (account.chainType as 'ethereum' | 'solana') || 'ethereum',
        chainId: account.chainId,
        walletClient: account.walletClient,
        connectorType: account.connectorType
      }));
  }

  /**
   * Extract email data from Privy user
   */
  private extractEmailData(privyUser: PrivyUser): PrivyEmailData[] {
    return privyUser.linkedAccounts
      .filter(account => account.type === 'email' && account.email)
      .map(account => ({
        email: account.email!,
        verified: account.verified || false
      }));
  }

  /**
   * Extract phone data from Privy user
   */
  private extractPhoneData(privyUser: PrivyUser): PrivyPhoneData[] {
    return privyUser.linkedAccounts
      .filter(account => account.type === 'phone' && account.phoneNumber)
      .map(account => ({
        phoneNumber: account.phoneNumber!,
        verified: account.verified || false
      }));
  }

  /**
   * Find user by Privy user ID in our database
   */
  private async findUserByPrivyId(privyUserId: string): Promise<User | null> {
    // This would query our database for users with this Privy ID
    // For now, returning null since we need to implement the database query
    return null;
  }

  /**
   * Create new user from Privy data
   */
  private async createUserFromPrivy(privyUser: PrivyUser): Promise<User> {
    const primaryWallet = this.extractPrimaryWallet(privyUser);
    const primaryEmail = this.extractPrimaryEmail(privyUser);

    if (!primaryEmail && !primaryWallet) {
      throw new PrivyAuthenticationError('No usable email or wallet found in Privy account');
    }

    // Generate a temporary email if user only has wallet
    const email = primaryEmail || `${primaryWallet?.toLowerCase()}@wallet.onekey`;
    const tempPassword = uuidv4(); // User won't use this password

    try {
      const authResponse = await authService.register({
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

      return authResponse.user as User;
    } catch (error) {
      console.error('Failed to create user from Privy data:', error);
      throw new PrivyAuthenticationError('Failed to create user account');
    }
  }

  /**
   * Update existing user with Privy data
   */
  private async updateUserWithPrivyData(existingUser: User, privyUser: PrivyUser): Promise<User> {
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
  private sanitizeUser(user: User): Omit<User, 'metadata'> {
    const { metadata, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Health check for Privy service
   */
  public getHealthStatus(): {
    configured: boolean;
    initialized: boolean;
    appId: string | null;
  } {
    return {
      configured: !!config.blockchain.privyAppId && !!config.blockchain.privyAppSecret,
      initialized: this.isInitialized,
      appId: config.blockchain.privyAppId ? config.blockchain.privyAppId.substring(0, 8) + '...' : null
    };
  }
}

// Export singleton instance
export const privyService = new PrivyService(); 
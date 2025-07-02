import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '@/config/environment';
import { 
  JWTPayload, 
  AuthTokens, 
  TokenExpiredError, 
  InvalidTokenError,
  User 
} from '@/types/auth';

// Refresh token storage (in production, use Redis or database)
const refreshTokens = new Map<string, {
  user_id: string;
  created_at: Date;
  expires_at: Date;
  revoked: boolean;
}>();

export class JWTService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = config.jwt.secret;
    this.refreshTokenSecret = config.jwt.refreshSecret;
    this.accessTokenExpiry = config.jwt.expiresIn;
    this.refreshTokenExpiry = config.jwt.refreshExpiresIn;

    // Validate JWT secrets
    if (!this.accessTokenSecret || this.accessTokenSecret.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long');
    }
    if (!this.refreshTokenSecret || this.refreshTokenSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  public generateTokens(user: User): AuthTokens {
    const now = Math.floor(Date.now() / 1000);
    
    // Create access token payload
    const accessPayload: JWTPayload = {
      user_id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
      iat: now,
      exp: now + this.parseExpiry(this.accessTokenExpiry),
      type: 'access'
    };

    // Create refresh token payload
    const refreshPayload: JWTPayload = {
      user_id: user.id,
      email: user.email,
      wallet_address: user.wallet_address,
      iat: now,
      exp: now + this.parseExpiry(this.refreshTokenExpiry),
      type: 'refresh'
    };

    // Generate tokens
    const accessToken = jwt.sign(accessPayload, this.accessTokenSecret);
    const refreshToken = jwt.sign(refreshPayload, this.refreshTokenSecret);

    // Store refresh token metadata
    this.storeRefreshToken(refreshToken, user.id, refreshPayload.exp);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: this.parseExpiry(this.accessTokenExpiry),
      token_type: 'Bearer'
    };
  }

  /**
   * Verify and decode an access token
   */
  public verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      
      if (decoded.type !== 'access') {
        throw new InvalidTokenError('Invalid token type');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Access token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError('Invalid access token');
      }
      throw error;
    }
  }

  /**
   * Verify and decode a refresh token
   */
  public verifyRefreshToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as JWTPayload;
      
      if (decoded.type !== 'refresh') {
        throw new InvalidTokenError('Invalid token type');
      }

      // Check if refresh token is revoked
      const tokenData = refreshTokens.get(token);
      if (!tokenData || tokenData.revoked) {
        throw new InvalidTokenError('Refresh token has been revoked');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('Refresh token has expired');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidTokenError('Invalid refresh token');
      }
      throw error;
    }
  }

  /**
   * Parse expiry string to seconds
   */
  private parseExpiry(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));
    
    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return parseInt(expiry); // Assume seconds if no unit
    }
  }

  /**
   * Refresh access token using a valid refresh token
   */
  public refreshAccessToken(refreshToken: string, user: User): AuthTokens {
    // Verify the refresh token
    const decoded = this.verifyRefreshToken(refreshToken);
    
    // Ensure the refresh token belongs to the user
    if (decoded.user_id !== user.id) {
      throw new InvalidTokenError('Refresh token does not belong to user');
    }

    // Generate new tokens
    return this.generateTokens(user);
  }

  /**
   * Revoke a refresh token
   */
  public revokeRefreshToken(token: string): void {
    const tokenData = refreshTokens.get(token);
    if (tokenData) {
      tokenData.revoked = true;
      refreshTokens.set(token, tokenData);
    }
  }

  /**
   * Revoke all refresh tokens for a user
   */
  public revokeAllUserTokens(userId: string): void {
    for (const [token, data] of refreshTokens.entries()) {
      if (data.user_id === userId) {
        data.revoked = true;
        refreshTokens.set(token, data);
      }
    }
  }

  /**
   * Generate a secure random nonce for wallet authentication
   */
  public generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Create a message for wallet signature verification
   */
  public createWalletMessage(nonce: string, domain: string = 'onekey-kyc.com'): string {
    return `Sign this message to authenticate with OneKey KYC:\n\nNonce: ${nonce}\nDomain: ${domain}\nTimestamp: ${new Date().toISOString()}`;
  }

  /**
   * Verify wallet signature (basic implementation - extend for specific wallets)
   */
  public verifyWalletSignature(
    message: string, 
    signature: string, 
    walletAddress: string
  ): boolean {
    // TODO: Implement actual signature verification based on wallet type
    // This is a placeholder implementation
    console.warn('Wallet signature verification not fully implemented');
    return signature.length > 0 && walletAddress.length > 0;
  }

  /**
   * Get token expiry information
   */
  public getTokenInfo(token: string, type: 'access' | 'refresh' = 'access'): {
    valid: boolean;
    expired: boolean;
    payload?: JWTPayload;
    expiresAt?: Date;
  } {
    try {
      const secret = type === 'access' ? this.accessTokenSecret : this.refreshTokenSecret;
      const decoded = jwt.verify(token, secret) as JWTPayload;
      
      return {
        valid: true,
        expired: false,
        payload: decoded,
        expiresAt: new Date(decoded.exp * 1000)
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        // Try to decode expired token to get info
        try {
          const secret = type === 'access' ? this.accessTokenSecret : this.refreshTokenSecret;
          const decoded = jwt.decode(token) as JWTPayload;
          return {
            valid: false,
            expired: true,
            payload: decoded,
            expiresAt: new Date(decoded.exp * 1000)
          };
        } catch {
          return { valid: false, expired: true };
        }
      }
      return { valid: false, expired: false };
    }
  }

  /**
   * Store refresh token metadata
   */
  private storeRefreshToken(token: string, userId: string, expiresAt: number): void {
    refreshTokens.set(token, {
      user_id: userId,
      created_at: new Date(),
      expires_at: new Date(expiresAt * 1000),
      revoked: false
    });
  }
}

// Export singleton instance
export const jwtService = new JWTService(); 
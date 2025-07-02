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
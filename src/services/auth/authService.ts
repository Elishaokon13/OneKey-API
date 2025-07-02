import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { query, transaction } from '@/config/database';
import { isSupabaseConfigured, getSupabaseServiceClient } from '@/config/supabase';
import { jwtService } from './jwtService';
import {
  User,
  CreateUserRequest,
  LoginRequest,
  AuthResponse,
  AuthTokens,
  AuthenticationError,
  WalletLoginRequest
} from '@/types/auth';

export class AuthService {
  private readonly saltRounds = 12;

  /**
   * Register a new user
   */
  async register(userData: CreateUserRequest): Promise<AuthResponse> {
    const { email, password, wallet_address, passkey_id, metadata = {} } = userData;

    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new AuthenticationError('User with this email already exists', 'USER_EXISTS');
      }

      // Check if wallet address is already in use
      if (wallet_address) {
        const existingWallet = await this.findUserByWalletAddress(wallet_address);
        if (existingWallet) {
          throw new AuthenticationError('Wallet address already in use', 'WALLET_EXISTS');
        }
      }

      // Hash the password
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // Create user record
      const userId = uuidv4();
      const now = new Date().toISOString();

      if (isSupabaseConfigured()) {
        // Use Supabase client
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('users')
          .insert({
            id: userId,
            email,
            password_hash: passwordHash,
            wallet_address,
            passkey_id,
            created_at: now,
            updated_at: now,
            is_active: true,
            metadata
          })
          .select()
          .single();

        if (error) {
          throw new AuthenticationError(`Registration failed: ${error.message}`, 'REGISTRATION_FAILED');
        }

        const user = this.mapDatabaseUserToUser(data);
        const tokens = jwtService.generateTokens(user);

        return {
          user: this.sanitizeUser(user),
          tokens
        };
      } else {
        // Use direct database query
        const result = await query(
          `INSERT INTO users (id, email, password_hash, wallet_address, passkey_id, created_at, updated_at, is_active, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, email, wallet_address, passkey_id, created_at, updated_at, is_active, metadata`,
          [userId, email, passwordHash, wallet_address, passkey_id, now, now, true, JSON.stringify(metadata)]
        );

        const user = this.mapDatabaseUserToUser(result.rows[0]);
        const tokens = jwtService.generateTokens(user);

        return {
          user: this.sanitizeUser(user),
          tokens
        };
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Registration error:', error);
      throw new AuthenticationError('Registration failed', 'REGISTRATION_FAILED');
    }
  }

  /**
   * Login with email and password
   */
  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginData;

    try {
      // Find user by email
      const user = await this.findUserByEmail(email);
      if (!user) {
        throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      if (!user.is_active) {
        throw new AuthenticationError('Account is disabled', 'ACCOUNT_DISABLED');
      }

      // Get password hash from database
      const passwordHash = await this.getUserPasswordHash(user.id);
      if (!passwordHash) {
        throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, passwordHash);
      if (!isPasswordValid) {
        throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate tokens
      const tokens = jwtService.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Login error:', error);
      throw new AuthenticationError('Login failed', 'LOGIN_FAILED');
    }
  }

  /**
   * Login with wallet signature
   */
  async walletLogin(walletData: WalletLoginRequest): Promise<AuthResponse> {
    const { wallet_address, signature, message, nonce } = walletData;

    try {
      // Verify the signature
      const isValidSignature = jwtService.verifyWalletSignature(message, signature, wallet_address);
      if (!isValidSignature) {
        throw new AuthenticationError('Invalid wallet signature', 'INVALID_SIGNATURE');
      }

      // Find user by wallet address
      let user = await this.findUserByWalletAddress(wallet_address);
      
      if (!user) {
        // Auto-register user with wallet
        const tempEmail = `${wallet_address.toLowerCase()}@wallet.onekey`;
        const tempPassword = uuidv4(); // Random password they won't use
        
        const registrationData: CreateUserRequest = {
          email: tempEmail,
          password: tempPassword,
          wallet_address,
          metadata: { wallet_registered: true, registration_nonce: nonce }
        };

        const authResponse = await this.register(registrationData);
        return authResponse;
      }

      if (!user.is_active) {
        throw new AuthenticationError('Account is disabled', 'ACCOUNT_DISABLED');
      }

      // Update last login
      await this.updateLastLogin(user.id);

      // Generate tokens
      const tokens = jwtService.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Wallet login error:', error);
      throw new AuthenticationError('Wallet login failed', 'WALLET_LOGIN_FAILED');
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      // Verify refresh token
      const decoded = jwtService.verifyRefreshToken(refreshToken);
      
      // Get user from database
      const user = await this.findUserById(decoded.user_id);
      if (!user || !user.is_active) {
        throw new AuthenticationError('User not found or inactive', 'USER_NOT_FOUND');
      }

      // Generate new tokens
      return jwtService.generateTokens(user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      console.error('Token refresh error:', error);
      throw new AuthenticationError('Token refresh failed', 'TOKEN_REFRESH_FAILED');
    }
  }

  /**
   * Find user by ID
   */
  async findUserById(userId: string): Promise<User | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
          .eq('id', userId)
          .single();

        if (error || !data) return null;
        return this.mapDatabaseUserToUser(data);
      } else {
        const result = await query(
          'SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) return null;
        return this.mapDatabaseUserToUser(result.rows[0]);
      }
    } catch (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
  }

  /**
   * Find user by email
   */
  async findUserByEmail(email: string): Promise<User | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
          .eq('email', email.toLowerCase())
          .single();

        if (error || !data) return null;
        return this.mapDatabaseUserToUser(data);
      } else {
        const result = await query(
          'SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE email = $1',
          [email.toLowerCase()]
        );
        
        if (result.rows.length === 0) return null;
        return this.mapDatabaseUserToUser(result.rows[0]);
      }
    } catch (error) {
      console.error('Error finding user by email:', error);
      return null;
    }
  }

  /**
   * Find user by wallet address
   */
  async findUserByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('users')
          .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
          .eq('wallet_address', walletAddress.toLowerCase())
          .single();

        if (error || !data) return null;
        return this.mapDatabaseUserToUser(data);
      } else {
        const result = await query(
          'SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE wallet_address = $1',
          [walletAddress.toLowerCase()]
        );
        
        if (result.rows.length === 0) return null;
        return this.mapDatabaseUserToUser(result.rows[0]);
      }
    } catch (error) {
      console.error('Error finding user by wallet address:', error);
      return null;
    }
  }

  /**
   * Get user's password hash
   */
  private async getUserPasswordHash(userId: string): Promise<string | null> {
    try {
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServiceClient();
        const { data, error } = await supabase
          .from('users')
          .select('password_hash')
          .eq('id', userId)
          .single();

        if (error || !data) return null;
        return data.password_hash;
      } else {
        const result = await query(
          'SELECT password_hash FROM users WHERE id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) return null;
        return result.rows[0].password_hash;
      }
    } catch (error) {
      console.error('Error getting password hash:', error);
      return null;
    }
  }

  /**
   * Update user's last login timestamp
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      if (isSupabaseConfigured()) {
        const supabase = getSupabaseServiceClient();
        await supabase
          .from('users')
          .update({ last_login: now, updated_at: now })
          .eq('id', userId);
      } else {
        await query(
          'UPDATE users SET last_login = $1, updated_at = $2 WHERE id = $3',
          [now, now, userId]
        );
      }
    } catch (error) {
      console.error('Error updating last login:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Map database row to User interface
   */
  private mapDatabaseUserToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      wallet_address: row.wallet_address,
      passkey_id: row.passkey_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_login: row.last_login,
      is_active: row.is_active,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata || {}
    };
  }

  /**
   * Remove sensitive data from user object
   */
  private sanitizeUser(user: User): Omit<User, 'metadata'> {
    const { metadata, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}

// Export singleton instance
export const authService = new AuthService(); 
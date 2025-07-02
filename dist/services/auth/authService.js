"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = exports.AuthService = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const uuid_1 = require("uuid");
const database_1 = require("@/config/database");
const supabase_1 = require("@/config/supabase");
const jwtService_1 = require("./jwtService");
const auth_1 = require("@/types/auth");
class AuthService {
    saltRounds = 12;
    /**
     * Register a new user
     */
    async register(userData) {
        const { email, password, wallet_address, passkey_id, metadata = {} } = userData;
        try {
            // Check if user already exists
            const existingUser = await this.findUserByEmail(email);
            if (existingUser) {
                throw new auth_1.AuthenticationError('User with this email already exists', 'USER_EXISTS');
            }
            // Check if wallet address is already in use
            if (wallet_address) {
                const existingWallet = await this.findUserByWalletAddress(wallet_address);
                if (existingWallet) {
                    throw new auth_1.AuthenticationError('Wallet address already in use', 'WALLET_EXISTS');
                }
            }
            // Hash the password
            const passwordHash = await bcrypt_1.default.hash(password, this.saltRounds);
            // Create user record
            const userId = (0, uuid_1.v4)();
            const now = new Date().toISOString();
            if ((0, supabase_1.isSupabaseConfigured)()) {
                // Use Supabase client
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
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
                    throw new auth_1.AuthenticationError(`Registration failed: ${error.message}`, 'REGISTRATION_FAILED');
                }
                const user = this.mapDatabaseUserToUser(data);
                const tokens = jwtService_1.jwtService.generateTokens(user);
                return {
                    user: this.sanitizeUser(user),
                    tokens
                };
            }
            else {
                // Use direct database query
                const result = await (0, database_1.query)(`INSERT INTO users (id, email, password_hash, wallet_address, passkey_id, created_at, updated_at, is_active, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, email, wallet_address, passkey_id, created_at, updated_at, is_active, metadata`, [userId, email, passwordHash, wallet_address, passkey_id, now, now, true, JSON.stringify(metadata)]);
                const user = this.mapDatabaseUserToUser(result.rows[0]);
                const tokens = jwtService_1.jwtService.generateTokens(user);
                return {
                    user: this.sanitizeUser(user),
                    tokens
                };
            }
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error('Registration error:', error);
            throw new auth_1.AuthenticationError('Registration failed', 'REGISTRATION_FAILED');
        }
    }
    /**
     * Login with email and password
     */
    async login(loginData) {
        const { email, password } = loginData;
        try {
            // Find user by email
            const user = await this.findUserByEmail(email);
            if (!user) {
                throw new auth_1.AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
            }
            if (!user.is_active) {
                throw new auth_1.AuthenticationError('Account is disabled', 'ACCOUNT_DISABLED');
            }
            // Get password hash from database
            const passwordHash = await this.getUserPasswordHash(user.id);
            if (!passwordHash) {
                throw new auth_1.AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
            }
            // Verify password
            const isPasswordValid = await bcrypt_1.default.compare(password, passwordHash);
            if (!isPasswordValid) {
                throw new auth_1.AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
            }
            // Update last login
            await this.updateLastLogin(user.id);
            // Generate tokens
            const tokens = jwtService_1.jwtService.generateTokens(user);
            return {
                user: this.sanitizeUser(user),
                tokens
            };
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error('Login error:', error);
            throw new auth_1.AuthenticationError('Login failed', 'LOGIN_FAILED');
        }
    }
    /**
     * Login with wallet signature
     */
    async walletLogin(walletData) {
        const { wallet_address, signature, message, nonce } = walletData;
        try {
            // Verify the signature
            const isValidSignature = jwtService_1.jwtService.verifyWalletSignature(message, signature, wallet_address);
            if (!isValidSignature) {
                throw new auth_1.AuthenticationError('Invalid wallet signature', 'INVALID_SIGNATURE');
            }
            // Find user by wallet address
            let user = await this.findUserByWalletAddress(wallet_address);
            if (!user) {
                // Auto-register user with wallet
                const tempEmail = `${wallet_address.toLowerCase()}@wallet.onekey`;
                const tempPassword = (0, uuid_1.v4)(); // Random password they won't use
                const registrationData = {
                    email: tempEmail,
                    password: tempPassword,
                    wallet_address,
                    metadata: { wallet_registered: true, registration_nonce: nonce }
                };
                const authResponse = await this.register(registrationData);
                return authResponse;
            }
            if (!user.is_active) {
                throw new auth_1.AuthenticationError('Account is disabled', 'ACCOUNT_DISABLED');
            }
            // Update last login
            await this.updateLastLogin(user.id);
            // Generate tokens
            const tokens = jwtService_1.jwtService.generateTokens(user);
            return {
                user: this.sanitizeUser(user),
                tokens
            };
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error('Wallet login error:', error);
            throw new auth_1.AuthenticationError('Wallet login failed', 'WALLET_LOGIN_FAILED');
        }
    }
    /**
     * Refresh access token
     */
    async refreshToken(refreshToken) {
        try {
            // Verify refresh token
            const decoded = jwtService_1.jwtService.verifyRefreshToken(refreshToken);
            // Get user from database
            const user = await this.findUserById(decoded.user_id);
            if (!user || !user.is_active) {
                throw new auth_1.AuthenticationError('User not found or inactive', 'USER_NOT_FOUND');
            }
            // Generate new tokens
            return jwtService_1.jwtService.generateTokens(user);
        }
        catch (error) {
            if (error instanceof auth_1.AuthenticationError) {
                throw error;
            }
            console.error('Token refresh error:', error);
            throw new auth_1.AuthenticationError('Token refresh failed', 'TOKEN_REFRESH_FAILED');
        }
    }
    /**
     * Find user by ID
     */
    async findUserById(userId) {
        try {
            if ((0, supabase_1.isSupabaseConfigured)()) {
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
                const { data, error } = await supabase
                    .from('users')
                    .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
                    .eq('id', userId)
                    .single();
                if (error || !data)
                    return null;
                return this.mapDatabaseUserToUser(data);
            }
            else {
                const result = await (0, database_1.query)('SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE id = $1', [userId]);
                if (result.rows.length === 0)
                    return null;
                return this.mapDatabaseUserToUser(result.rows[0]);
            }
        }
        catch (error) {
            console.error('Error finding user by ID:', error);
            return null;
        }
    }
    /**
     * Find user by email
     */
    async findUserByEmail(email) {
        try {
            if ((0, supabase_1.isSupabaseConfigured)()) {
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
                const { data, error } = await supabase
                    .from('users')
                    .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
                    .eq('email', email.toLowerCase())
                    .single();
                if (error || !data)
                    return null;
                return this.mapDatabaseUserToUser(data);
            }
            else {
                const result = await (0, database_1.query)('SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE email = $1', [email.toLowerCase()]);
                if (result.rows.length === 0)
                    return null;
                return this.mapDatabaseUserToUser(result.rows[0]);
            }
        }
        catch (error) {
            console.error('Error finding user by email:', error);
            return null;
        }
    }
    /**
     * Find user by wallet address
     */
    async findUserByWalletAddress(walletAddress) {
        try {
            if ((0, supabase_1.isSupabaseConfigured)()) {
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
                const { data, error } = await supabase
                    .from('users')
                    .select('id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata')
                    .eq('wallet_address', walletAddress.toLowerCase())
                    .single();
                if (error || !data)
                    return null;
                return this.mapDatabaseUserToUser(data);
            }
            else {
                const result = await (0, database_1.query)('SELECT id, email, wallet_address, passkey_id, created_at, updated_at, last_login, is_active, metadata FROM users WHERE wallet_address = $1', [walletAddress.toLowerCase()]);
                if (result.rows.length === 0)
                    return null;
                return this.mapDatabaseUserToUser(result.rows[0]);
            }
        }
        catch (error) {
            console.error('Error finding user by wallet address:', error);
            return null;
        }
    }
    /**
     * Get user's password hash
     */
    async getUserPasswordHash(userId) {
        try {
            if ((0, supabase_1.isSupabaseConfigured)()) {
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
                const { data, error } = await supabase
                    .from('users')
                    .select('password_hash')
                    .eq('id', userId)
                    .single();
                if (error || !data)
                    return null;
                return data.password_hash;
            }
            else {
                const result = await (0, database_1.query)('SELECT password_hash FROM users WHERE id = $1', [userId]);
                if (result.rows.length === 0)
                    return null;
                return result.rows[0].password_hash;
            }
        }
        catch (error) {
            console.error('Error getting password hash:', error);
            return null;
        }
    }
    /**
     * Update user's last login timestamp
     */
    async updateLastLogin(userId) {
        try {
            const now = new Date().toISOString();
            if ((0, supabase_1.isSupabaseConfigured)()) {
                const supabase = (0, supabase_1.getSupabaseServiceClient)();
                await supabase
                    .from('users')
                    .update({ last_login: now, updated_at: now })
                    .eq('id', userId);
            }
            else {
                await (0, database_1.query)('UPDATE users SET last_login = $1, updated_at = $2 WHERE id = $3', [now, now, userId]);
            }
        }
        catch (error) {
            console.error('Error updating last login:', error);
            // Don't throw - this is not critical
        }
    }
    /**
     * Map database row to User interface
     */
    mapDatabaseUserToUser(row) {
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
    sanitizeUser(user) {
        const { metadata, ...sanitizedUser } = user;
        return sanitizedUser;
    }
}
exports.AuthService = AuthService;
// Export singleton instance
exports.authService = new AuthService();
//# sourceMappingURL=authService.js.map
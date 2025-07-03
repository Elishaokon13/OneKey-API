import { User, CreateUserRequest, LoginRequest, AuthResponse, AuthTokens, WalletLoginRequest } from '../../types/auth';
export declare class AuthService {
    private readonly saltRounds;
    /**
     * Register a new user
     */
    register(userData: CreateUserRequest): Promise<AuthResponse>;
    /**
     * Login with email and password
     */
    login(loginData: LoginRequest): Promise<AuthResponse>;
    /**
     * Login with wallet signature
     */
    walletLogin(walletData: WalletLoginRequest): Promise<AuthResponse>;
    /**
     * Refresh access token
     */
    refreshToken(refreshToken: string): Promise<AuthTokens>;
    /**
     * Find user by ID
     */
    findUserById(userId: string): Promise<User | null>;
    /**
     * Find user by email
     */
    findUserByEmail(email: string): Promise<User | null>;
    /**
     * Find user by wallet address
     */
    findUserByWalletAddress(walletAddress: string): Promise<User | null>;
    /**
     * Get user's password hash
     */
    private getUserPasswordHash;
    /**
     * Update user's last login timestamp
     */
    private updateLastLogin;
    /**
     * Map database row to User interface
     */
    private mapDatabaseUserToUser;
    /**
     * Remove sensitive data from user object
     */
    private sanitizeUser;
}
export declare const authService: AuthService;
//# sourceMappingURL=authService.d.ts.map
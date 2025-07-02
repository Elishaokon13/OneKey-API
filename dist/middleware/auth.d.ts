import { Request, Response, NextFunction } from 'express';
import { User } from '@/types/auth';
declare global {
    namespace Express {
        interface Request {
            user?: User;
            token?: string;
        }
    }
}
/**
 * JWT Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export declare const authenticateJWT: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Optional JWT Authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export declare const optionalAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Authorization middleware factory
 * Checks if user has required permissions
 */
export declare const requirePermissions: (permissions: string[]) => (req: Request, res: Response, next: NextFunction) => void;
/**
 * Wallet ownership verification middleware
 * Ensures the authenticated user owns the specified wallet
 */
export declare const requireWalletOwnership: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Rate limiting middleware for authentication endpoints
 */
export declare const authRateLimit: (req: Request, res: Response, next: NextFunction) => void;
/**
 * API Key authentication middleware
 * For server-to-server authentication
 */
export declare const authenticateAPIKey: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware to ensure user has completed KYC
 */
export declare const requireKYCCompletion: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Development-only middleware to bypass authentication
 */
export declare const bypassAuthInDev: (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=auth.d.ts.map
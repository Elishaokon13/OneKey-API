import { Request, Response, NextFunction } from 'express';
import { PrivyAuthContext } from '@/types/privy';
import { User } from '@/types/auth';
declare global {
    namespace Express {
        interface Request {
            privyUser?: any;
            privyContext?: PrivyAuthContext;
            privyToken?: string;
            user?: User | null;
        }
    }
}
/**
 * Privy Authentication middleware
 * Verifies Privy access token and attaches user context to request
 */
export declare const authenticatePrivy: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Optional Privy Authentication middleware
 * Attaches Privy context if token is provided, but doesn't require it
 */
export declare const optionalPrivyAuth: (req: Request, res: Response, next: NextFunction) => Promise<void>;
/**
 * Middleware that requires Privy user to be linked to our internal system
 */
export declare const requirePrivyLinkedUser: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware that requires specific wallet to be linked to Privy user
 */
export declare const requirePrivyWallet: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Middleware that requires verified email in Privy account
 */
export declare const requireVerifiedEmail: (req: Request, res: Response, next: NextFunction) => void;
/**
 * Hybrid authentication middleware
 * Accepts both JWT and Privy tokens
 */
export declare const authenticateHybrid: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=privyAuth.d.ts.map
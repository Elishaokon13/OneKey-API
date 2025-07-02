import { Request, Response, NextFunction } from 'express';
import { privyService } from '@/services/auth/privyService';
import { authService } from '@/services/auth/authService';
import {
  PrivyAuthenticationError,
  PrivyVerificationError,
  PrivySessionError,
  PrivyAuthContext
} from '@/types/privy';
import { User } from '@/types/auth';

// Extend Express Request type for Privy
declare global {
  namespace Express {
    interface Request {
      privyUser?: any; // Privy user object
      privyContext?: PrivyAuthContext;
      privyToken?: string;
    }
  }
}

/**
 * Privy Authentication middleware
 * Verifies Privy access token and attaches user context to request
 */
export const authenticatePrivy = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if Privy is configured
    if (!privyService.isConfigured()) {
      res.status(503).json({
        error: 'PRIVY_NOT_CONFIGURED',
        message: 'Privy authentication service is not configured',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authorization header is required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      res.status(401).json({
        error: 'INVALID_TOKEN_FORMAT',
        message: 'Bearer token is required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // Verify the Privy access token
    const verification = await privyService.verifyAccessToken(token);
    
    if (!verification.isValid) {
      if (verification.isExpired) {
        res.status(401).json({
          error: 'TOKEN_EXPIRED',
          message: 'Privy access token has expired',
          requestId: req.headers['x-request-id']
        });
        return;
      }

      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid Privy access token',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    if (!verification.user) {
      res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User not found in Privy',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // Get our internal user record if it exists
    const internalUser = await findInternalUserFromPrivy(verification.user);
    
    // Get full Privy context
    const privyContext = await privyService.getAuthContext(token);

    // Attach Privy data to request
    req.privyUser = verification.user;
    req.privyContext = privyContext;
    req.privyToken = token;
    (req as any).user = internalUser; // May be null if user doesn't exist in our system yet
    
    next();
  } catch (error) {
    if (error instanceof PrivyVerificationError) {
      res.status(401).json({
        error: 'PRIVY_VERIFICATION_FAILED',
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    if (error instanceof PrivyAuthenticationError) {
      res.status(401).json({
        error: 'PRIVY_AUTH_FAILED',
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('Privy authentication error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal Privy authentication error',
      requestId: req.headers['x-request-id']
    });
  }
};

/**
 * Optional Privy Authentication middleware
 * Attaches Privy context if token is provided, but doesn't require it
 */
export const optionalPrivyAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !privyService.isConfigured()) {
    // No token provided or Privy not configured, continue without authentication
    next();
    return;
  }

  try {
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token) {
      const verification = await privyService.verifyAccessToken(token);
      
      if (verification.isValid && verification.user) {
        const internalUser = await findInternalUserFromPrivy(verification.user);
        const privyContext = await privyService.getAuthContext(token);

        req.privyUser = verification.user;
        req.privyContext = privyContext;
        req.privyToken = token;
        req.user = internalUser;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.warn('Optional Privy auth failed:', error);
  }
  
  next();
};

/**
 * Middleware that requires Privy user to be linked to our internal system
 */
export const requirePrivyLinkedUser = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.privyUser) {
    res.status(401).json({
      error: 'PRIVY_AUTH_REQUIRED',
      message: 'Privy authentication required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  if (!req.user) {
    res.status(403).json({
      error: 'USER_NOT_LINKED',
      message: 'Privy user not linked to OneKey account. Please complete registration.',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  next();
};

/**
 * Middleware that requires specific wallet to be linked to Privy user
 */
export const requirePrivyWallet = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.privyContext) {
    res.status(401).json({
      error: 'PRIVY_AUTH_REQUIRED',
      message: 'Privy authentication required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  const requiredWallet = req.params.walletAddress || req.body.wallet_address;
  
  if (!requiredWallet) {
    res.status(400).json({
      error: 'WALLET_ADDRESS_REQUIRED',
      message: 'Wallet address is required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  const hasWallet = req.privyContext.linkedWallets.some(
    wallet => wallet.address.toLowerCase() === requiredWallet.toLowerCase()
  );

  if (!hasWallet) {
    res.status(403).json({
      error: 'WALLET_NOT_LINKED',
      message: 'Specified wallet is not linked to your Privy account',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  next();
};

/**
 * Middleware that requires verified email in Privy account
 */
export const requireVerifiedEmail = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.privyContext) {
    res.status(401).json({
      error: 'PRIVY_AUTH_REQUIRED',
      message: 'Privy authentication required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  const hasVerifiedEmail = req.privyContext.linkedEmails.some(
    email => email.verified
  );

  if (!hasVerifiedEmail) {
    res.status(403).json({
      error: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Verified email required for this operation',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  next();
};

/**
 * Hybrid authentication middleware
 * Accepts both JWT and Privy tokens
 */
export const authenticateHybrid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authorization header is required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;

  if (!token) {
    res.status(401).json({
      error: 'INVALID_TOKEN_FORMAT',
      message: 'Bearer token is required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  // Try JWT authentication first
  try {
    const { authenticateJWT } = await import('./auth');
    await authenticateJWT(req, res, () => {
      // JWT auth succeeded
      req.headers['auth-type'] = 'jwt';
      next();
    });
    return;
  } catch (jwtError) {
    // JWT failed, try Privy if configured
    if (privyService.isConfigured()) {
      try {
        await authenticatePrivy(req, res, () => {
          // Privy auth succeeded
          req.headers['auth-type'] = 'privy';
          next();
        });
        return;
      } catch (privyError) {
        // Both failed
        res.status(401).json({
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid token for both JWT and Privy authentication',
          requestId: req.headers['x-request-id']
        });
        return;
      }
    } else {
      // Only JWT available and it failed
      res.status(401).json({
        error: 'AUTHENTICATION_FAILED',
        message: 'Invalid JWT token',
        requestId: req.headers['x-request-id']
      });
      return;
    }
  }
};

/**
 * Helper function to find internal user from Privy user data
 */
async function findInternalUserFromPrivy(privyUser: any): Promise<User | null> {
  try {
    // Extract email and wallet from Privy user
    const emailAccounts = privyUser.linkedAccounts?.filter(
      (account: any) => account.type === 'email' && account.email
    ) || [];
    
    const walletAccounts = privyUser.linkedAccounts?.filter(
      (account: any) => account.type === 'wallet' && account.address
    ) || [];

    // Try to find user by email first
    for (const emailAccount of emailAccounts) {
      const user = await authService.findUserByEmail(emailAccount.email);
      if (user) return user;
    }

    // Try to find user by wallet address
    for (const walletAccount of walletAccounts) {
      const user = await authService.findUserByWalletAddress(walletAccount.address);
      if (user) return user;
    }

    return null;
  } catch (error) {
    console.error('Error finding internal user from Privy data:', error);
    return null;
  }
} 
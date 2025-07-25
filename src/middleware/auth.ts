import { Request, Response, NextFunction } from 'express';
import { jwtService } from '@/services/auth/jwtService';
import { authService } from '@/services/auth/authService';
import { 
  AuthenticatedRequest, 
  AuthenticationError, 
  TokenExpiredError, 
  InvalidTokenError,
  User 
} from '@/types/auth';

// Extend Express Request type
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
export const authenticateJWT = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
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

    // Verify the JWT token
    const decoded = jwtService.verifyAccessToken(token);
    
    // Get user from database to ensure they still exist and are active
    const user = await authService.findUserById(decoded.user_id);
    
    if (!user) {
      res.status(401).json({
        error: 'USER_NOT_FOUND',
        message: 'User associated with token not found',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    if (!user.is_active) {
      res.status(401).json({
        error: 'ACCOUNT_DISABLED',
        message: 'Account has been disabled',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      res.status(401).json({
        error: 'TOKEN_EXPIRED',
        message: 'Access token has expired',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    if (error instanceof InvalidTokenError) {
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid access token',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('JWT authentication error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error',
      requestId: req.headers['x-request-id']
    });
  }
};

/**
 * Optional JWT Authentication middleware
 * Attaches user to request if token is provided, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No token provided, continue without authentication
    next();
    return;
  }

  try {
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (token) {
      const decoded = jwtService.verifyAccessToken(token);
      const user = await authService.findUserById(decoded.user_id);
      
      if (user && user.is_active) {
        req.user = user;
        req.token = token;
      }
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.warn('Optional auth failed:', error);
  }
  
  next();
};

/**
 * Authorization middleware factory
 * Checks if user has required permissions
 */
export const requirePermissions = (permissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for this endpoint',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // TODO: Implement permission checking based on user role/permissions
    // For now, all authenticated users have access
    const userPermissions = req.user.metadata?.permissions || [];
    const hasPermission = permissions.some(permission => 
      userPermissions.includes(permission) || userPermissions.includes('*')
    );

    if (!hasPermission && permissions.length > 0) {
      res.status(403).json({
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `Required permissions: ${permissions.join(', ')}`,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    next();
  };
};

/**
 * Wallet ownership verification middleware
 * Ensures the authenticated user owns the specified wallet
 */
export const requireWalletOwnership = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  const walletAddress = req.params.walletAddress || req.body.wallet_address;
  
  if (!walletAddress) {
    res.status(400).json({
      error: 'WALLET_ADDRESS_REQUIRED',
      message: 'Wallet address is required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  if (!req.user.wallet_address) {
    res.status(403).json({
      error: 'NO_WALLET_LINKED',
      message: 'No wallet linked to user account',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  if (req.user.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
    res.status(403).json({
      error: 'WALLET_OWNERSHIP_REQUIRED',
      message: 'User does not own the specified wallet',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  next();
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  // This would typically use the rate limiter we created earlier
  // For now, we'll just pass through
  next();
};

/**
 * API Key authentication middleware
 * For server-to-server authentication
 */
export const authenticateAPIKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({
        error: 'API_KEY_REQUIRED',
        message: 'X-API-Key header is required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // TODO: Implement API key verification
    // This would check against the api_keys table
    console.warn('API Key authentication not fully implemented');
    
    res.status(401).json({
      error: 'API_KEY_INVALID',
      message: 'Invalid API key',
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    console.error('API Key authentication error:', error);
    res.status(500).json({
      error: 'AUTHENTICATION_ERROR',
      message: 'Internal authentication error',
      requestId: req.headers['x-request-id']
    });
  }
};

/**
 * Middleware to ensure user has completed KYC
 */
export const requireKYCCompletion = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  // TODO: Check if user has completed KYC
  // This would query the kyc_sessions table
  const hasCompletedKYC = req.user.metadata?.kyc_completed || false;
  
  if (!hasCompletedKYC) {
    res.status(403).json({
      error: 'KYC_REQUIRED',
      message: 'KYC verification must be completed to access this endpoint',
      requestId: req.headers['x-request-id']
    });
    return;
  }

  next();
};

/**
 * Development-only middleware to bypass authentication
 */
export const bypassAuthInDev = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH === 'true') {
    // Create a mock user for development
    req.user = {
      id: 'dev-user-id',
      email: 'dev@onekey.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true,
      metadata: { dev_user: true, permissions: ['*'] }
    };
    next();
    return;
  }
  
  next();
}; 
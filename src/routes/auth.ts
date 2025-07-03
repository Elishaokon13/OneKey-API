import { Router, Request, Response } from 'express';
import { authLimiter } from '@/middleware/rateLimiter';
import { authenticatePrivy } from '@/middleware/privyAuth';
import { authService } from '@/services/auth/authService';
import { jwtService } from '@/services/auth/jwtService';
import {
  CreateUserRequest,
  LoginRequest,
  WalletLoginRequest,
  RefreshTokenRequest,
  AuthenticationError
} from '@/types/auth';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register a new user with email and password
 */
router.post('/register', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, wallet_address, passkey_id, metadata }: CreateUserRequest = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Password must be at least 8 characters long',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const result = await authService.register({
      email: email.toLowerCase(),
      password,
      wallet_address: wallet_address || undefined,
      passkey_id: passkey_id || undefined,
      metadata: metadata || undefined
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(400).json({
        error: error.code,
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('Registration error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Registration failed',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post('/login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Email and password are required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const result = await authService.login({
      email: email.toLowerCase(),
      password
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        error: error.code,
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('Login error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Login failed',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * POST /api/v1/auth/wallet-login
 * Login with wallet signature
 */
router.post('/wallet-login', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet_address, signature, message, nonce }: WalletLoginRequest = req.body;

    // Validation
    if (!wallet_address || !signature || !message || !nonce) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'wallet_address, signature, message, and nonce are required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const result = await authService.walletLogin({
      wallet_address: wallet_address.toLowerCase(),
      signature,
      message,
      nonce
    });

    res.status(200).json({
      success: true,
      message: 'Wallet login successful',
      data: result,
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        error: error.code,
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('Wallet login error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Wallet login failed',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', authLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token }: RefreshTokenRequest = req.body;

    if (!refresh_token) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'refresh_token is required',
        requestId: req.headers['x-request-id']
      });
      return;
    }

    const tokens = await authService.refreshToken(refresh_token);

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: tokens,
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      res.status(401).json({
        error: error.code,
        message: error.message,
        requestId: req.headers['x-request-id']
      });
      return;
    }

    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Token refresh failed',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout user (revoke refresh token)
 */
router.post('/logout', authenticatePrivy, async (req: Request, res: Response): Promise<void> => {
  try {
    const { refresh_token } = req.body;

    if (refresh_token) {
      // Revoke the specific refresh token
      jwtService.revokeRefreshToken(refresh_token);
    } else {
      // Revoke all user's refresh tokens
      jwtService.revokeAllUserTokens(req.user!.id);
    }

    res.status(200).json({
      success: true,
      message: 'Logout successful',
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Logout failed',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user profile
 */
router.get('/me', authenticatePrivy, async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    
    // Remove sensitive metadata
    const { metadata, ...publicUser } = user;

    res.status(200).json({
      success: true,
      data: {
        user: publicUser
      },
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get user profile',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * GET /api/v1/auth/nonce
 * Get a nonce for wallet signature
 */
router.get('/nonce', async (req: Request, res: Response): Promise<void> => {
  try {
    const nonce = jwtService.generateNonce();
    const message = jwtService.createWalletMessage(nonce);

    res.status(200).json({
      success: true,
      data: {
        nonce,
        message
      },
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to generate nonce',
      requestId: req.headers['x-request-id']
    });
  }
});

/**
 * GET /api/v1/auth/status
 * Check authentication status and token validity
 */
router.get('/status', authenticatePrivy, async (req: Request, res: Response): Promise<void> => {
  try {
    const tokenInfo = jwtService.getTokenInfo(req.token!, 'access');

    res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: {
          id: req.user!.id,
          email: req.user!.email,
          wallet_address: req.user!.wallet_address,
          is_active: req.user!.is_active
        },
        token: {
          valid: tokenInfo.valid,
          expiresAt: tokenInfo.expiresAt
        }
      },
      requestId: req.headers['x-request-id']
    });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Failed to get auth status',
      requestId: req.headers['x-request-id']
    });
  }
});

export default router; 
// OneKey KYC API - KYC Routes

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticatePrivy } from '@/middleware/privyAuth';
import { generalLimiter, kycLimiter } from '@/middleware/rateLimiter';
import { KycService } from '@/services/kyc/kycService';
import {
  CreateKycSessionRequest,
  KycApiResponse,
  KycSessionNotFoundError
} from '@/types/kyc';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const kycService = new KycService();

const validateCreateSession = [
  body('user.firstName').notEmpty().withMessage('First name is required'),
  body('user.lastName').notEmpty().withMessage('Last name is required'),
  body('user.address.country').notEmpty().withMessage('Country is required')
];

const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: errors.array() },
      requestId: uuidv4(),
      timestamp: new Date().toISOString()
    });
    return;
  }
  next();
};

/**
 * POST /api/v1/kyc/sessions - Create new KYC session
 */
router.post('/sessions', 
  authenticatePrivy,
  kycLimiter,
  validateCreateSession,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const createRequest: CreateKycSessionRequest = {
        ...req.body,
        user: { ...req.body.user, id: req.user!.id },
        metadata: { ...req.body.metadata, ipAddress: req.ip, userAgent: req.get('User-Agent') }
      };

      const session = await kycService.createSession(createRequest);
      res.status(201).json({ success: true, data: session, requestId, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/v1/kyc/sessions/:sessionId/verify - Start verification
 */
router.post('/sessions/:sessionId/verify',
  authenticatePrivy,
  kycLimiter,
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        throw new Error('Session ID is required');
      }
      const verificationResult = await kycService.startVerification(sessionId);
      res.json({ success: true, data: verificationResult, requestId, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'VERIFICATION_ERROR', message: (error as Error).message },
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/kyc/providers - Get available providers
 */
router.get('/providers',
  authenticatePrivy,
  generalLimiter,
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const providers = kycService.getAvailableProviders();
      const publicProviders = providers.map(provider => ({
        provider: provider.provider,
        enabled: provider.enabled,
        capabilities: provider.capabilities,
        supportedCountries: provider.supportedCountries,
        supportedDocuments: provider.supportedDocuments
      }));

      res.json({ success: true, data: publicProviders, requestId, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/kyc/providers/health - Get provider health status
 */
router.get('/providers/health',
  authenticatePrivy,
  generalLimiter,
  async (req: Request, res: Response) => {
    const requestId = uuidv4();
    
    try {
      const healthStatus = await kycService.getProvidersHealth();
      res.json({ success: true, data: healthStatus, requestId, timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
        requestId,
        timestamp: new Date().toISOString()
      });
    }
  }
);

export default router;
// OneKey KYC API - Attestation Routes
// REST API endpoints for blockchain attestation management

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticateJWT, requireKYCCompletion } from '../middleware/auth';
import { applyAttestationRateLimit } from '../middleware/rateLimiter';
import { AttestationService } from '../services/attestation/attestationService';
import { KycService } from '../services/kyc/kycService';
import { 
  AttestationError,
  CreateAttestationRequest,
  VerifyAttestationRequest,
  RevokeAttestationRequest 
} from '../types/attestation';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const attestationService = new AttestationService();
const kycService = new KycService();

// ===== Validation Middleware =====

const validateCreateAttestation = [
  body('recipient')
    .isEthereumAddress()
    .withMessage('Recipient must be a valid Ethereum address'),
  body('kycSessionId')
    .isUUID()
    .withMessage('KYC session ID must be a valid UUID'),
  body('expirationHours')
    .optional()
    .isInt({ min: 1, max: 8760 }) // Max 1 year
    .withMessage('Expiration hours must be between 1 and 8760'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const validateGetAttestation = [
  param('uid')
    .isLength({ min: 64, max: 66 })
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('UID must be a valid 32-byte hex string')
];

const validateVerifyAttestation = [
  body('uid')
    .isLength({ min: 64, max: 66 })
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('UID must be a valid 32-byte hex string'),
  body('recipient')
    .optional()
    .isEthereumAddress()
    .withMessage('Recipient must be a valid Ethereum address'),
  body('includeRevoked')
    .optional()
    .isBoolean()
    .withMessage('Include revoked must be a boolean'),
  body('includeExpired')
    .optional()
    .isBoolean()
    .withMessage('Include expired must be a boolean')
];

const validateListAttestations = [
  query('recipient')
    .isEthereumAddress()
    .withMessage('Recipient must be a valid Ethereum address'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  query('includeRevoked')
    .optional()
    .isBoolean()
    .withMessage('Include revoked must be a boolean'),
  query('includeExpired')
    .optional()
    .isBoolean()
    .withMessage('Include expired must be a boolean')
];

const validateRevokeAttestation = [
  body('uid')
    .isLength({ min: 64, max: 66 })
    .matches(/^0x[a-fA-F0-9]{64}$/)
    .withMessage('UID must be a valid 32-byte hex string'),
  body('reason')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Reason must be a string with max 500 characters')
];

const validateEstimateCost = [
  body('recipient')
    .isEthereumAddress()
    .withMessage('Recipient must be a valid Ethereum address'),
  body('kycSessionId')
    .isUUID()
    .withMessage('KYC session ID must be a valid UUID')
];

// ===== Helper Functions =====

const handleValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      },
      requestId: req.headers['x-request-id'] || 'unknown',
      timestamp: new Date().toISOString()
    });
    return true;
  }
  return false;
};

const logRequest = (req: Request, endpoint: string) => {
  logger.info(`Attestation API request: ${endpoint}`, {
    method: req.method,
    endpoint,
    userId: req.user?.id,
    userWallet: req.user?.wallet_address,
    requestId: req.headers['x-request-id'],
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
};

// ===== API Routes =====

/**
 * POST /api/v1/attestations
 * Create a new attestation from KYC verification
 */
router.post(
  '/',
  authenticateJWT,
  requireKYCCompletion,
  applyAttestationRateLimit,
  validateCreateAttestation,
  async (req: Request, res: Response): Promise<void> => {
    logRequest(req, 'CREATE_ATTESTATION');

    if (handleValidationErrors(req, res)) return;

    try {
      const { recipient, kycSessionId, expirationHours, metadata } = req.body;
      
      // Get KYC verification result
      const kycResult = await kycService.getVerificationResult(kycSessionId);
      
      if (!kycResult) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'KYC_SESSION_NOT_FOUND',
            message: 'KYC session not found'
          },
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString()
        });
      }

      // Verify user owns the KYC session
      if (kycResult.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'KYC_SESSION_ACCESS_DENIED',
            message: 'Access denied to KYC session'
          },
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString()
        });
      }

      // Create attestation
      const result = await attestationService.createAttestationFromKyc(
        recipient,
        kycResult,
        {
          expirationHours,
          metadata: {
            ...metadata,
            createdBy: req.user!.id,
            createdVia: 'api',
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        }
      );

      logger.info('Attestation creation completed', {
        success: result.success,
        uid: result.data?.attestation.uid,
        transactionHash: result.data?.transactionHash,
        userId: req.user!.id
      });

      if (result.success) {
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Attestation creation failed', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.id,
        requestId: req.headers['x-request-id']
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/attestations/:uid
 * Get attestation details by UID
 */
router.get(
  '/:uid',
  authenticateJWT,
  validateGetAttestation,
  async (req: Request, res: Response) => {
    logRequest(req, 'GET_ATTESTATION');

    if (handleValidationErrors(req, res)) return;

    try {
      const { uid } = req.params;
      
      const result = await attestationService.getAttestation(uid!);

      logger.info('Attestation retrieval completed', {
        success: result.success,
        uid,
        userId: req.user!.id
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        const statusCode = result.error?.code === 'ATTESTATION_NOT_FOUND' ? 404 : 400;
        res.status(statusCode).json(result);
      }

    } catch (error) {
      logger.error('Attestation retrieval failed', {
        error: error instanceof Error ? error.message : String(error),
        uid: req.params.uid,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/v1/attestations/verify
 * Verify attestation validity
 */
router.post(
  '/verify',
  authenticateJWT,
  validateVerifyAttestation,
  async (req: Request, res: Response) => {
    logRequest(req, 'VERIFY_ATTESTATION');

    if (handleValidationErrors(req, res)) return;

    try {
      const verifyRequest: VerifyAttestationRequest = req.body;
      
      const result = await attestationService.verifyAttestation(verifyRequest);

      logger.info('Attestation verification completed', {
        success: result.success,
        uid: verifyRequest.uid,
        valid: result.data?.valid,
        userId: req.user!.id
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Attestation verification failed', {
        error: error instanceof Error ? error.message : String(error),
        uid: req.body.uid,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/attestations
 * List attestations for a recipient
 */
router.get(
  '/',
  authenticateJWT,
  validateListAttestations,
  async (req: Request, res: Response) => {
    logRequest(req, 'LIST_ATTESTATIONS');

    if (handleValidationErrors(req, res)) return;

    try {
      const { recipient, limit, offset, includeRevoked, includeExpired } = req.query;
      
      const options: {
        limit?: number;
        offset?: number;
        includeRevoked?: boolean;
        includeExpired?: boolean;
      } = {};
      
      if (limit) options.limit = parseInt(limit as string);
      if (offset) options.offset = parseInt(offset as string);
      if (includeRevoked !== undefined) options.includeRevoked = includeRevoked === 'true';
      if (includeExpired !== undefined) options.includeExpired = includeExpired === 'true';

      const result = await attestationService.listAttestations(
        recipient as string,
        options
      );

      logger.info('Attestation listing completed', {
        success: result.success,
        recipient,
        total: result.data?.total,
        userId: req.user!.id
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Attestation listing failed', {
        error: error instanceof Error ? error.message : String(error),
        recipient: req.query.recipient,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/v1/attestations/revoke
 * Revoke an attestation
 */
router.post(
  '/revoke',
  authenticateJWT,
  applyAttestationRateLimit,
  validateRevokeAttestation,
  async (req: Request, res: Response) => {
    logRequest(req, 'REVOKE_ATTESTATION');

    if (handleValidationErrors(req, res)) return;

    try {
      const revokeRequest: RevokeAttestationRequest = {
        ...req.body,
        metadata: {
          revokedBy: req.user!.id,
          revokedVia: 'api',
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      };
      
      const result = await attestationService.revokeAttestation(revokeRequest);

      logger.info('Attestation revocation completed', {
        success: result.success,
        uid: revokeRequest.uid,
        userId: req.user!.id
      });

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      logger.error('Attestation revocation failed', {
        error: error instanceof Error ? error.message : String(error),
        uid: req.body.uid,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/v1/attestations/estimate-cost
 * Estimate gas cost for creating an attestation
 */
router.post(
  '/estimate-cost',
  authenticateJWT,
  validateEstimateCost,
  async (req: Request, res: Response): Promise<void> => {
    logRequest(req, 'ESTIMATE_ATTESTATION_COST');

    if (handleValidationErrors(req, res)) return;

    try {
      const { recipient, kycSessionId } = req.body;
      
      // Get KYC verification result
      const kycResult = await kycService.getVerificationResult(kycSessionId);
      
      if (!kycResult) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'KYC_SESSION_NOT_FOUND',
            message: 'KYC session not found'
          },
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString()
        });
      }

      // Verify user owns the KYC session
      if (kycResult.userId !== req.user!.id) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'KYC_SESSION_ACCESS_DENIED',
            message: 'Access denied to KYC session'
          },
          requestId: req.headers['x-request-id'],
          timestamp: new Date().toISOString()
        });
      }

      const result = await attestationService.estimateAttestationCost(recipient, kycResult);

      logger.info('Attestation cost estimation completed', {
        success: result.success,
        recipient,
        gasLimit: result.data?.gasLimit,
        userId: req.user!.id
      });

      res.status(200).json(result);

    } catch (error) {
      logger.error('Attestation cost estimation failed', {
        error: error instanceof Error ? error.message : String(error),
        recipient: req.body.recipient,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred'
        },
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/attestations/health
 * Get attestation service health status
 */
router.get(
  '/health',
  async (req: Request, res: Response) => {
    try {
      const health = await attestationService.getHealthStatus();

      res.status(health.status === 'healthy' ? 200 : 503).json({
        success: true,
        data: health,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Attestation health check failed', { error });

      res.status(503).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: 'Health check failed'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/v1/attestations/stats
 * Get attestation statistics
 */
router.get(
  '/stats',
  authenticateJWT,
  async (req: Request, res: Response) => {
    try {
      const stats = attestationService.getStats();

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Attestation stats retrieval failed', { error });

      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_RETRIEVAL_FAILED',
          message: 'Failed to retrieve statistics'
        },
        timestamp: new Date().toISOString()
      });
    }
  }
);

export { router as attestationRoutes };
export { attestationService }; 
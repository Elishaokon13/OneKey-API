/**
 * OneKey KYC API - Encryption Routes
 * 
 * REST API endpoints for client-side encryption, decryption, key management,
 * and file encryption operations.
 */

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticateJWT } from '@/middleware/auth';
import { rateLimiter } from '@/middleware/rateLimiter';
import { encryptionService } from '@/services/encryption/encryptionService';
import {
  EncryptionApiResponse,
  EncryptionRequest,
  DecryptionRequest,
  KeyGenerationRequest,
  EncryptionError,
  DecryptionError,
  KeyManagementError
} from '@/types/encryption';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: EncryptionApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      },
      requestId: req.requestId || uuidv4(),
      timestamp: Date.now()
    };
    return res.status(400).json(response);
  }
  next();
};

/**
 * POST /api/v1/encryption/encrypt
 * Encrypt data using AES-256-GCM encryption
 */
router.post('/encrypt',
  authenticateJWT,
  rateLimiter.encryptionOperations,
  body('data').notEmpty().withMessage('Data is required'),
  body('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('keyId').optional().isUUID().withMessage('KeyId must be a valid UUID'),
  handleValidationErrors,
  async (req, res) => {
    const requestId = req.requestId || uuidv4();

    try {
      const encryptionRequest: EncryptionRequest = {
        data: req.body.data,
        password: req.body.password,
        keyId: req.body.keyId,
        metadata: {
          userId: req.user?.id,
          ...req.body.metadata
        }
      };

      const result = await encryptionService.encrypt(encryptionRequest);

      const response: EncryptionApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: Date.now()
      };

      logger.info('Data encrypted successfully', {
        requestId,
        userId: req.user?.id,
        algorithm: result.algorithm
      });

      res.json(response);

    } catch (error) {
      logger.error('Encryption endpoint error', {
        requestId,
        userId: req.user?.id,
        error: error.message
      });

      const response: EncryptionApiResponse = {
        success: false,
        error: {
          code: error instanceof EncryptionError ? error.code : 'ENCRYPTION_ERROR',
          message: error.message
        },
        requestId,
        timestamp: Date.now()
      };

      res.status(error instanceof EncryptionError ? 400 : 500).json(response);
    }
  }
);

/**
 * POST /api/v1/encryption/decrypt
 * Decrypt data using stored keys or provided password
 */
router.post('/decrypt',
  authenticate,
  rateLimiter.encryptionOperations,
  body('encryptedData').notEmpty().withMessage('Encrypted data is required'),
  body('iv').notEmpty().withMessage('IV is required'),
  body('salt').notEmpty().withMessage('Salt is required'),
  body('authTag').notEmpty().withMessage('Auth tag is required'),
  body('algorithm').notEmpty().withMessage('Algorithm is required'),
  handleValidationErrors,
  async (req, res) => {
    const requestId = req.requestId || uuidv4();

    try {
      const decryptionRequest: DecryptionRequest = {
        encryptedData: req.body.encryptedData,
        iv: req.body.iv,
        salt: req.body.salt,
        authTag: req.body.authTag,
        algorithm: req.body.algorithm,
        password: req.body.password,
        keyId: req.body.keyId
      };

      const result = await encryptionService.decrypt(decryptionRequest);

      const response: EncryptionApiResponse = {
        success: true,
        data: {
          data: result.data.toString('utf8'),
          verified: result.verified,
          metadata: result.metadata
        },
        requestId,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      const response: EncryptionApiResponse = {
        success: false,
        error: {
          code: error instanceof DecryptionError ? error.code : 'DECRYPTION_ERROR',
          message: error.message
        },
        requestId,
        timestamp: Date.now()
      };

      res.status(error instanceof DecryptionError ? 400 : 500).json(response);
    }
  }
);

/**
 * POST /api/v1/encryption/keys/generate
 * Generate a new encryption key
 */
router.post('/keys/generate',
  authenticate,
  rateLimiter.keyManagement,
  body('usage').isArray().withMessage('Usage must be an array'),
  handleValidationErrors,
  async (req, res) => {
    const requestId = req.requestId || uuidv4();

    try {
      const keyGenerationRequest: KeyGenerationRequest = {
        password: req.body.password,
        keyId: req.body.keyId,
        usage: req.body.usage,
        expiresIn: req.body.expiresIn,
        metadata: {
          userId: req.user?.id,
          ...req.body.metadata
        }
      };

      const result = await encryptionService.generateKey(keyGenerationRequest);

      const response: EncryptionApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      const response: EncryptionApiResponse = {
        success: false,
        error: {
          code: error instanceof KeyManagementError ? error.code : 'KEY_GENERATION_ERROR',
          message: error.message
        },
        requestId,
        timestamp: Date.now()
      };

      res.status(error instanceof KeyManagementError ? 400 : 500).json(response);
    }
  }
);

/**
 * GET /api/v1/encryption/health
 * Get encryption service health status
 */
router.get('/health',
  rateLimiter.general,
  async (req, res) => {
    const requestId = req.requestId || uuidv4();

    try {
      const health = encryptionService.getHealthStatus();

      const response: EncryptionApiResponse = {
        success: true,
        data: health,
        requestId,
        timestamp: Date.now()
      };

      res.json(response);

    } catch (error) {
      const response: EncryptionApiResponse = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error.message
        },
        requestId,
        timestamp: Date.now()
      };

      res.status(500).json(response);
    }
  }
);

export default router; 
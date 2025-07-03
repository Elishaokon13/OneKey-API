// OneKey KYC API - Arweave Storage Routes

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authenticatePrivy } from '@/middleware/privyAuth';
import { fileEncryptionLimiter, generalLimiter, encryptionOperationsLimiter } from '@/middleware/rateLimiter';
import { ArweaveService } from '@/services/storage/arweaveService';
import {
  ArweaveStorageRequest,
  ArweaveRetrievalRequest,
  ArweaveApiResponse,
  ArweaveUploadApiResponse,
  ArweaveRetrievalApiResponse,
  ArweaveHealthApiResponse,
  ArweaveStatsApiResponse
} from '@/types/arweave';
import { config } from '@/config/environment';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Initialize Arweave service
const arweaveService = new ArweaveService(config.arweave);

// Rate limiters for different operations
const arweaveUploadLimiter = fileEncryptionLimiter; // Reuse file encryption limiter
const arweaveRetrievalLimiter = encryptionOperationsLimiter; // Reuse encryption operations limiter
const arweaveGeneralLimiter = generalLimiter; // Reuse general limiter

// Validation middleware
const validateUpload = [
  body('data').notEmpty().withMessage('Data is required'),
  body('contentType').notEmpty().withMessage('Content type is required'),
  body('tags').isArray().withMessage('Tags must be an array'),
  body('metadata.category').isIn(['kyc_document', 'attestation_metadata', 'audit_log', 'backup', 'other']).withMessage('Invalid category'),
  body('metadata.uploadedBy').notEmpty().withMessage('Uploaded by is required'),
  body('metadata.dataHash').notEmpty().withMessage('Data hash is required')
];

const validateRetrieval = [
  param('transactionId').isLength({ min: 43, max: 43 }).withMessage('Invalid transaction ID')
];

const handleValidationErrors = (req: Request, res: Response, next: Function): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const response: ArweaveApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: errors.array()
      },
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      processingTime: 0
    };
    res.status(400).json(response);
    return;
  }
  next();
};

/**
 * POST /api/v1/storage/arweave/upload - Upload data to Arweave
 */
router.post('/upload',
  authenticatePrivy,
  arweaveUploadLimiter,
  validateUpload,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const uploadRequest: ArweaveStorageRequest = {
        ...req.body,
        metadata: {
          ...req.body.metadata,
          uploadedBy: req.user!.id,
          uploadTimestamp: new Date().toISOString()
        }
      };

      const result = await arweaveService.uploadData(uploadRequest);
      
      const response: ArweaveUploadApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(201).json(response);

    } catch (error) {
      const response: ArweaveUploadApiResponse = {
        success: false,
        error: {
          code: 'UPLOAD_FAILED',
          message: error instanceof Error ? error.message : 'Upload failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/v1/storage/arweave/retrieve/:transactionId - Retrieve data from Arweave
 */
router.get('/retrieve/:transactionId',
  authenticatePrivy,
  arweaveRetrievalLimiter,
  validateRetrieval,
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const retrievalRequest: ArweaveRetrievalRequest = {
        transactionId: req.params.transactionId,
        decrypt: req.query.decrypt === 'true',
        verifyIntegrity: req.query.verifyIntegrity === 'true',
        preferredGateway: req.query.preferredGateway as string
      };

      const result = await arweaveService.retrieveData(retrievalRequest);
      
      const response: ArweaveRetrievalApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.json(response);

    } catch (error) {
      const response: ArweaveRetrievalApiResponse = {
        success: false,
        error: {
          code: 'RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Retrieval failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/v1/storage/arweave/health - Get Arweave service health
 */
router.get('/health',
  authenticatePrivy,
  arweaveGeneralLimiter,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const healthStatus = await arweaveService.getHealthStatus();
      
      const response: ArweaveHealthApiResponse = {
        success: true,
        data: healthStatus,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.json(response);

    } catch (error) {
      const response: ArweaveHealthApiResponse = {
        success: false,
        error: {
          code: 'HEALTH_CHECK_FAILED',
          message: error instanceof Error ? error.message : 'Health check failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

/**
 * GET /api/v1/storage/arweave/stats - Get usage statistics
 */
router.get('/stats',
  authenticatePrivy,
  arweaveGeneralLimiter,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const stats = arweaveService.getStats();
      
      const response: ArweaveStatsApiResponse = {
        success: true,
        data: stats,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.json(response);

    } catch (error) {
      const response: ArweaveStatsApiResponse = {
        success: false,
        error: {
          code: 'STATS_FAILED',
          message: error instanceof Error ? error.message : 'Stats retrieval failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

/**
 * POST /api/v1/storage/arweave/attestation/:attestationId/store - Store attestation data
 */
router.post('/attestation/:attestationId/store',
  authenticatePrivy,
  arweaveUploadLimiter,
  param('attestationId').isUUID().withMessage('Invalid attestation ID'),
  body('metadata').isObject().withMessage('Metadata is required'),
  body('documents').isArray().withMessage('Documents must be an array'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const attestationId = req.params.attestationId;
      const { metadata, documents } = req.body;

      // Convert base64 documents to buffers
      const documentBuffers = documents.map((doc: string) => Buffer.from(doc, 'base64'));

      const result = await arweaveService.storeAttestationData(attestationId, metadata, documentBuffers);
      
      const response: ArweaveApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(201).json(response);

    } catch (error) {
      const response: ArweaveApiResponse = {
        success: false,
        error: {
          code: 'ATTESTATION_STORAGE_FAILED',
          message: error instanceof Error ? error.message : 'Attestation storage failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

/**
 * POST /api/v1/storage/arweave/kyc/:sessionId/store - Store KYC data
 */
router.post('/kyc/:sessionId/store',
  authenticatePrivy,
  arweaveUploadLimiter,
  param('sessionId').isUUID().withMessage('Invalid session ID'),
  body('encryptedData').isString().withMessage('Encrypted data is required'),
  body('documents').isArray().withMessage('Documents must be an array'),
  handleValidationErrors,
  async (req: Request, res: Response) => {
    const startTime = Date.now();
    const requestId = uuidv4();

    try {
      const sessionId = req.params.sessionId;
      const { encryptedData, documents } = req.body;

      // Convert base64 data to buffers
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const documentBuffers = documents.map((doc: string) => Buffer.from(doc, 'base64'));

      const result = await arweaveService.storeKycData(sessionId, encryptedBuffer, documentBuffers);
      
      const response: ArweaveApiResponse = {
        success: true,
        data: result,
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(201).json(response);

    } catch (error) {
      const response: ArweaveApiResponse = {
        success: false,
        error: {
          code: 'KYC_STORAGE_FAILED',
          message: error instanceof Error ? error.message : 'KYC storage failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        },
        requestId,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime
      };

      res.status(500).json(response);
    }
  }
);

export default router;
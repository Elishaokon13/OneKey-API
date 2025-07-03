"use strict";
// OneKey KYC API - Arweave Storage Routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const privyAuth_1 = require("@/middleware/privyAuth");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const arweaveService_1 = require("@/services/storage/arweaveService");
const environment_1 = require("@/config/environment");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Initialize Arweave service
const arweaveService = new arweaveService_1.ArweaveService(environment_1.config.arweave);
// Rate limiters for different operations
const arweaveUploadLimiter = rateLimiter_1.fileEncryptionLimiter; // Reuse file encryption limiter
const arweaveRetrievalLimiter = rateLimiter_1.encryptionOperationsLimiter; // Reuse encryption operations limiter
const arweaveGeneralLimiter = rateLimiter_1.generalLimiter; // Reuse general limiter
// Validation middleware
const validateUpload = [
    (0, express_validator_1.body)('data').notEmpty().withMessage('Data is required'),
    (0, express_validator_1.body)('contentType').notEmpty().withMessage('Content type is required'),
    (0, express_validator_1.body)('tags').isArray().withMessage('Tags must be an array'),
    (0, express_validator_1.body)('metadata.category').isIn(['kyc_document', 'attestation_metadata', 'audit_log', 'backup', 'other']).withMessage('Invalid category'),
    (0, express_validator_1.body)('metadata.uploadedBy').notEmpty().withMessage('Uploaded by is required'),
    (0, express_validator_1.body)('metadata.dataHash').notEmpty().withMessage('Data hash is required')
];
const validateRetrieval = [
    (0, express_validator_1.param)('transactionId').isLength({ min: 43, max: 43 }).withMessage('Invalid transaction ID')
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        const response = {
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: errors.array()
            },
            requestId: (0, uuid_1.v4)(),
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
router.post('/upload', privyAuth_1.authenticatePrivy, arweaveUploadLimiter, validateUpload, handleValidationErrors, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const uploadRequest = {
            ...req.body,
            metadata: {
                ...req.body.metadata,
                uploadedBy: req.user?.id || 'anonymous',
                uploadTimestamp: new Date().toISOString()
            }
        };
        const result = await arweaveService.uploadData(uploadRequest);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.status(201).json(response);
    }
    catch (error) {
        const response = {
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
});
/**
 * GET /api/v1/storage/arweave/retrieve/:transactionId - Retrieve data from Arweave
 */
router.get('/retrieve/:transactionId', privyAuth_1.authenticatePrivy, arweaveRetrievalLimiter, validateRetrieval, handleValidationErrors, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const retrievalRequest = {
            transactionId: req.params.transactionId,
            decrypt: req.query.decrypt === 'true',
            verifyIntegrity: req.query.verifyIntegrity === 'true',
            preferredGateway: typeof req.query.preferredGateway === 'string' ? req.query.preferredGateway : undefined
        };
        const result = await arweaveService.retrieveData(retrievalRequest);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.json(response);
    }
    catch (error) {
        const response = {
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
});
/**
 * GET /api/v1/storage/arweave/health - Get Arweave service health
 */
router.get('/health', privyAuth_1.authenticatePrivy, arweaveGeneralLimiter, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const healthStatus = await arweaveService.getHealthStatus();
        const response = {
            success: true,
            data: healthStatus,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.json(response);
    }
    catch (error) {
        const response = {
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
});
/**
 * GET /api/v1/storage/arweave/stats - Get usage statistics
 */
router.get('/stats', privyAuth_1.authenticatePrivy, arweaveGeneralLimiter, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const stats = arweaveService.getStats();
        const response = {
            success: true,
            data: stats,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.json(response);
    }
    catch (error) {
        const response = {
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
});
/**
 * POST /api/v1/storage/arweave/attestation/:attestationId/store - Store attestation data
 */
router.post('/attestation/:attestationId/store', privyAuth_1.authenticatePrivy, arweaveUploadLimiter, (0, express_validator_1.param)('attestationId').isUUID().withMessage('Invalid attestation ID'), (0, express_validator_1.body)('metadata').isObject().withMessage('Metadata is required'), (0, express_validator_1.body)('documents').isArray().withMessage('Documents must be an array'), handleValidationErrors, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const attestationId = req.params.attestationId;
        const { metadata, documents } = req.body;
        // Convert base64 documents to buffers
        const documentBuffers = documents.map((doc) => Buffer.from(doc, 'base64'));
        const result = await arweaveService.storeAttestationData(attestationId, metadata, documentBuffers);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.status(201).json(response);
    }
    catch (error) {
        const response = {
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
});
/**
 * POST /api/v1/storage/arweave/kyc/:sessionId/store - Store KYC data
 */
router.post('/kyc/:sessionId/store', privyAuth_1.authenticatePrivy, arweaveUploadLimiter, (0, express_validator_1.param)('sessionId').isUUID().withMessage('Invalid session ID'), (0, express_validator_1.body)('encryptedData').isString().withMessage('Encrypted data is required'), (0, express_validator_1.body)('documents').isArray().withMessage('Documents must be an array'), handleValidationErrors, async (req, res) => {
    const startTime = Date.now();
    const requestId = (0, uuid_1.v4)();
    try {
        const sessionId = req.params.sessionId;
        const { encryptedData, documents } = req.body;
        // Convert base64 data to buffers
        const encryptedBuffer = Buffer.from(encryptedData, 'base64');
        const documentBuffers = documents.map((doc) => Buffer.from(doc, 'base64'));
        const result = await arweaveService.storeKycData(sessionId, encryptedBuffer, documentBuffers);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: new Date().toISOString(),
            processingTime: Date.now() - startTime
        };
        res.status(201).json(response);
    }
    catch (error) {
        const response = {
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
});
exports.default = router;
//# sourceMappingURL=arweave.js.map
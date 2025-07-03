"use strict";
/**
 * OneKey KYC API - Encryption Routes
 *
 * REST API endpoints for client-side encryption, decryption, key management,
 * and file encryption operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const privyAuth_1 = require("../middleware/privyAuth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const encryptionService_1 = require("../services/encryption/encryptionService");
const encryption_1 = require("../types/encryption");
const logger_1 = require("../utils/logger");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
// Validation middleware
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
            requestId: req.requestId || (0, uuid_1.v4)(),
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
router.post('/encrypt', privyAuth_1.authenticatePrivy, rateLimiter_1.rateLimiter.encryptionOperations, (0, express_validator_1.body)('data').notEmpty().withMessage('Data is required'), (0, express_validator_1.body)('password').optional().isLength({ min: 8 }).withMessage('Password must be at least 8 characters'), (0, express_validator_1.body)('keyId').optional().isUUID().withMessage('KeyId must be a valid UUID'), handleValidationErrors, async (req, res) => {
    const requestId = req.requestId || (0, uuid_1.v4)();
    try {
        const encryptionRequest = {
            data: req.body.data,
            password: req.body.password,
            keyId: req.body.keyId,
            metadata: {
                userId: req.user?.id,
                ...req.body.metadata
            }
        };
        const result = await encryptionService_1.encryptionService.encrypt(encryptionRequest);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: Date.now()
        };
        logger_1.logger.info('Data encrypted successfully', {
            requestId,
            userId: req.user?.id,
            algorithm: result.algorithm
        });
        res.json(response);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Encryption endpoint error', {
            requestId,
            userId: req.user?.id,
            error: errorMessage
        });
        const response = {
            success: false,
            error: {
                code: error instanceof encryption_1.EncryptionError ? error.code : 'ENCRYPTION_ERROR',
                message: errorMessage
            },
            requestId,
            timestamp: Date.now()
        };
        res.status(error instanceof encryption_1.EncryptionError ? 400 : 500).json(response);
    }
});
/**
 * POST /api/v1/encryption/decrypt
 * Decrypt data using stored keys or provided password
 */
router.post('/decrypt', privyAuth_1.authenticatePrivy, rateLimiter_1.rateLimiter.encryptionOperations, (0, express_validator_1.body)('encryptedData').notEmpty().withMessage('Encrypted data is required'), (0, express_validator_1.body)('iv').notEmpty().withMessage('IV is required'), (0, express_validator_1.body)('salt').notEmpty().withMessage('Salt is required'), (0, express_validator_1.body)('authTag').notEmpty().withMessage('Auth tag is required'), (0, express_validator_1.body)('algorithm').notEmpty().withMessage('Algorithm is required'), handleValidationErrors, async (req, res) => {
    const requestId = req.requestId || (0, uuid_1.v4)();
    try {
        const decryptionRequest = {
            encryptedData: req.body.encryptedData,
            iv: req.body.iv,
            salt: req.body.salt,
            authTag: req.body.authTag,
            algorithm: req.body.algorithm,
            password: req.body.password,
            keyId: req.body.keyId
        };
        const result = await encryptionService_1.encryptionService.decrypt(decryptionRequest);
        const response = {
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
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response = {
            success: false,
            error: {
                code: error instanceof encryption_1.DecryptionError ? error.code : 'DECRYPTION_ERROR',
                message: errorMessage
            },
            requestId,
            timestamp: Date.now()
        };
        res.status(error instanceof encryption_1.DecryptionError ? 400 : 500).json(response);
    }
});
/**
 * POST /api/v1/encryption/keys/generate
 * Generate a new encryption key
 */
router.post('/keys/generate', privyAuth_1.authenticatePrivy, rateLimiter_1.rateLimiter.keyManagement, (0, express_validator_1.body)('usage').isArray().withMessage('Usage must be an array'), handleValidationErrors, async (req, res) => {
    const requestId = req.requestId || (0, uuid_1.v4)();
    try {
        const keyGenerationRequest = {
            password: req.body.password,
            keyId: req.body.keyId,
            usage: req.body.usage,
            expiresIn: req.body.expiresIn,
            metadata: {
                userId: req.user?.id,
                ...req.body.metadata
            }
        };
        const result = await encryptionService_1.encryptionService.generateKey(keyGenerationRequest);
        const response = {
            success: true,
            data: result,
            requestId,
            timestamp: Date.now()
        };
        res.json(response);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response = {
            success: false,
            error: {
                code: error instanceof encryption_1.KeyManagementError ? error.code : 'KEY_GENERATION_ERROR',
                message: errorMessage
            },
            requestId,
            timestamp: Date.now()
        };
        res.status(error instanceof encryption_1.KeyManagementError ? 400 : 500).json(response);
    }
});
/**
 * GET /api/v1/encryption/health
 * Get encryption service health status
 */
router.get('/health', rateLimiter_1.rateLimiter.general, async (req, res) => {
    const requestId = req.requestId || (0, uuid_1.v4)();
    try {
        const health = encryptionService_1.encryptionService.getHealthStatus();
        const response = {
            success: true,
            data: health,
            requestId,
            timestamp: Date.now()
        };
        res.json(response);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const response = {
            success: false,
            error: {
                code: 'HEALTH_CHECK_ERROR',
                message: errorMessage
            },
            requestId,
            timestamp: Date.now()
        };
        res.status(500).json(response);
    }
});
exports.default = router;
//# sourceMappingURL=encryption.js.map
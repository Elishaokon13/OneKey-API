"use strict";
// OneKey KYC API - KYC Routes
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("@/middleware/auth");
const rateLimiter_1 = require("@/middleware/rateLimiter");
const kycService_1 = require("@/services/kyc/kycService");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
const kycService = new kycService_1.KycService();
const validateCreateSession = [
    (0, express_validator_1.body)('user.firstName').notEmpty().withMessage('First name is required'),
    (0, express_validator_1.body)('user.lastName').notEmpty().withMessage('Last name is required'),
    (0, express_validator_1.body)('user.address.country').notEmpty().withMessage('Country is required')
];
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: errors.array() },
            requestId: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString()
        });
    }
    next();
};
/**
 * POST /api/v1/kyc/sessions - Create new KYC session
 */
router.post('/sessions', auth_1.authenticate, (0, rateLimiter_1.applyRateLimit)('kyc'), validateCreateSession, handleValidationErrors, async (req, res) => {
    const requestId = (0, uuid_1.v4)();
    try {
        const createRequest = {
            ...req.body,
            user: { ...req.body.user, id: req.user.id },
            metadata: { ...req.body.metadata, ipAddress: req.ip, userAgent: req.get('User-Agent') }
        };
        const session = await kycService.createSession(createRequest);
        res.status(201).json({ success: true, data: session, requestId, timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * POST /api/v1/kyc/sessions/:sessionId/verify - Start verification
 */
router.post('/sessions/:sessionId/verify', auth_1.authenticate, (0, rateLimiter_1.applyRateLimit)('kyc'), async (req, res) => {
    const requestId = (0, uuid_1.v4)();
    try {
        const { sessionId } = req.params;
        const verificationResult = await kycService.startVerification(sessionId);
        res.json({ success: true, data: verificationResult, requestId, timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'VERIFICATION_ERROR', message: error.message },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/v1/kyc/providers - Get available providers
 */
router.get('/providers', auth_1.authenticate, (0, rateLimiter_1.applyRateLimit)('general'), async (req, res) => {
    const requestId = (0, uuid_1.v4)();
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
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
});
/**
 * GET /api/v1/kyc/providers/health - Get provider health status
 */
router.get('/providers/health', auth_1.authenticate, (0, rateLimiter_1.applyRateLimit)('general'), async (req, res) => {
    const requestId = (0, uuid_1.v4)();
    try {
        const healthStatus = await kycService.getProvidersHealth();
        res.json({ success: true, data: healthStatus, requestId, timestamp: new Date().toISOString() });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message },
            requestId,
            timestamp: new Date().toISOString()
        });
    }
});
exports.default = router;
//# sourceMappingURL=kyc.js.map
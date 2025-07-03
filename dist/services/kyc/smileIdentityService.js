"use strict";
// OneKey KYC API - Smile Identity Service
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmileIdentityService = void 0;
const baseKycService_1 = require("./baseKycService");
const kyc_1 = require("../../types/kyc");
const environment_1 = require("../../config/environment");
class SmileIdentityService extends baseKycService_1.BaseKycService {
    provider = 'smile_identity';
    constructor() {
        const providerConfig = {
            provider: 'smile_identity',
            enabled: !!environment_1.config.kycProviders.smileIdentity.apiKey,
            priority: 1,
            config: {
                apiKey: environment_1.config.kycProviders.smileIdentity.apiKey,
                baseUrl: 'https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test',
                testMode: environment_1.config.server.nodeEnv !== 'production'
            },
            capabilities: {
                documentVerification: true,
                biometricVerification: true,
                livenessDetection: true,
                addressVerification: false,
                sanctionsScreening: false,
                pepScreening: false
            },
            supportedCountries: ['NG', 'KE', 'GH', 'ZA', 'UG', 'RW', 'TZ'],
            supportedDocuments: ['passport', 'national_id', 'drivers_license', 'voter_id']
        };
        super(providerConfig);
        console.log(`🔧 Smile Identity service initialized (${this.config.enabled ? 'enabled' : 'disabled'})`);
    }
    async createProviderSession(session, request) {
        console.log(`📄 Creating Smile Identity session for ${session.sessionId}`);
        if (!this.config.enabled) {
            throw new kyc_1.KycProviderError('Smile Identity service is not configured', this.provider, 'SERVICE_DISABLED', 'API key not provided');
        }
    }
    async performVerification(session) {
        console.log(`🔍 Starting Smile Identity verification for session ${session.sessionId}`);
        // Mock verification result for now
        const confidence = Math.floor(Math.random() * 30) + 70; // 70-100%
        const passed = confidence > 75;
        return {
            sessionId: session.sessionId,
            provider: this.provider,
            status: passed ? 'completed' : 'failed',
            confidence,
            user: {
                id: session.userId,
                firstName: 'Mock',
                lastName: 'User'
            },
            document: {
                type: session.documentType || 'unknown',
                verified: passed,
                extractedData: {},
                confidence: confidence
            },
            biometric: {
                type: 'selfie',
                verified: passed,
                confidence: confidence,
                livenessScore: passed ? confidence : 0
            },
            checks: {
                documentAuthenticity: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                },
                faceMatch: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                },
                addressVerification: {
                    status: 'not_applicable',
                    confidence: 0
                },
                identityVerification: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                },
                livenessDetection: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                }
            },
            riskAssessment: {
                level: confidence > 90 ? 'low' : confidence > 75 ? 'medium' : 'high',
                score: 100 - confidence,
                reasons: passed ? [] : ['Low confidence score']
            },
            providerResponse: {
                rawResponse: { mock: true },
                providerSessionId: `smile_${Date.now()}`,
                providerStatus: passed ? 'SUCCESS' : 'FAILED',
                timestamp: new Date().toISOString()
            },
            metadata: {
                processingTime: 2500,
                ipAddress: session.metadata.ipAddress,
                userAgent: session.metadata.userAgent
            },
            createdAt: session.createdAt,
            completedAt: new Date().toISOString(),
            expiresAt: session.expiresAt
        };
    }
    async checkProviderHealth() {
        return {
            status: this.config.enabled ? 'operational' : 'disabled',
            apiConnectivity: this.config.enabled,
            configuration: !!environment_1.config.kycProviders.smileIdentity.apiKey,
            supportedCountries: this.config.supportedCountries.length,
            lastChecked: new Date().toISOString()
        };
    }
}
exports.SmileIdentityService = SmileIdentityService;
//# sourceMappingURL=smileIdentityService.js.map
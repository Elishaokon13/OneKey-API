"use strict";
// OneKey KYC API - Onfido Service
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnfidoService = void 0;
const baseKycService_1 = require("./baseKycService");
const kyc_1 = require("@/types/kyc");
const environment_1 = __importDefault(require("@/config/environment"));
class OnfidoService extends baseKycService_1.BaseKycService {
    provider = 'onfido';
    constructor() {
        const providerConfig = {
            provider: 'onfido',
            enabled: !!environment_1.default.kycProviders.onfido.apiKey,
            priority: 2,
            config: {
                apiKey: environment_1.default.kycProviders.onfido.apiKey,
                baseUrl: 'https://api.onfido.com/v3.6',
                testMode: environment_1.default.server.nodeEnv !== 'production'
            },
            capabilities: {
                documentVerification: true,
                biometricVerification: true,
                livenessDetection: true,
                addressVerification: true,
                sanctionsScreening: true,
                pepScreening: true
            },
            supportedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE'],
            supportedDocuments: ['passport', 'drivers_license', 'national_id', 'residence_permit']
        };
        super(providerConfig);
        console.log(`🔧 Onfido service initialized (${this.config.enabled ? 'enabled' : 'disabled'})`);
    }
    async createProviderSession(session, request) {
        console.log(`📄 Creating Onfido session for ${session.sessionId}`);
        if (!this.config.enabled) {
            throw new kyc_1.KycProviderError('Onfido service is not configured', this.provider, 'SERVICE_DISABLED', 'API key not provided');
        }
    }
    async performVerification(session) {
        console.log(`🔍 Starting Onfido verification for session ${session.sessionId}`);
        // Mock verification result for now
        const confidence = Math.floor(Math.random() * 20) + 80; // 80-100%
        const passed = confidence > 85;
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
                type: 'facial_similarity',
                verified: passed,
                confidence: confidence
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
                    status: passed ? 'pass' : 'not_applicable',
                    confidence: passed ? confidence : 0
                },
                identityVerification: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                },
                livenessDetection: {
                    status: 'not_applicable',
                    confidence: 0
                },
                sanctions: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                },
                pep: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence
                }
            },
            riskAssessment: {
                level: confidence > 90 ? 'low' : confidence > 75 ? 'medium' : 'high',
                score: 100 - confidence,
                reasons: passed ? [] : ['Document concerns']
            },
            providerResponse: {
                rawResponse: { mock: true },
                providerSessionId: `onfido_${Date.now()}`,
                providerStatus: passed ? 'CLEAR' : 'CONSIDER',
                timestamp: new Date().toISOString()
            },
            metadata: {
                processingTime: 3500,
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
            configuration: !!environment_1.default.kycProviders.onfido.apiKey,
            supportedCountries: this.config.supportedCountries.length,
            lastChecked: new Date().toISOString()
        };
    }
}
exports.OnfidoService = OnfidoService;
//# sourceMappingURL=onfidoService.js.map
"use strict";
// OneKey KYC API - Trulioo Service
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TruliooService = void 0;
const baseKycService_1 = require("./baseKycService");
const kyc_1 = require("../../types/kyc");
const environment_1 = __importDefault(require("../../config/environment"));
class TruliooService extends baseKycService_1.BaseKycService {
    provider = 'trulioo';
    constructor() {
        const providerConfig = {
            provider: 'trulioo',
            enabled: !!environment_1.default.kycProviders.trulioo.apiKey,
            priority: 3,
            config: {
                apiKey: environment_1.default.kycProviders.trulioo.apiKey,
                baseUrl: 'https://api.globaldatacompany.com',
                testMode: environment_1.default.server.nodeEnv !== 'production'
            },
            capabilities: {
                documentVerification: false,
                biometricVerification: false,
                livenessDetection: false,
                addressVerification: true,
                sanctionsScreening: true,
                pepScreening: true
            },
            supportedCountries: [
                'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT',
                'SE', 'DK', 'NO', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'HU', 'SK', 'SI',
                'HR', 'EE', 'LV', 'LT', 'LU', 'MT', 'CY', 'BG', 'RO', 'JP', 'SG', 'HK',
                'NZ', 'ZA', 'BR', 'MX', 'IN', 'PH', 'MY', 'TH', 'ID', 'VN', 'KR', 'TW',
                'CN', 'RU', 'TR', 'EG', 'SA', 'AE', 'IL', 'AR', 'CL', 'CO', 'PE', 'VE'
            ],
            supportedDocuments: ['national_id'] // Primarily for identity verification, not document scanning
        };
        super(providerConfig);
        console.log(`🔧 Trulioo service initialized (${this.config.enabled ? 'enabled' : 'disabled'})`);
    }
    async createProviderSession(session, request) {
        console.log(`📄 Creating Trulioo session for ${session.sessionId}`);
        if (!this.config.enabled) {
            throw new kyc_1.KycProviderError('Trulioo service is not configured', this.provider, 'SERVICE_DISABLED', 'API key not provided');
        }
        // Trulioo focuses on identity verification rather than document scanning
        if (request.document && !this.config.capabilities.documentVerification) {
            console.log('⚠️ Trulioo does not support document verification - using identity data only');
        }
    }
    async performVerification(session) {
        console.log(`🔍 Starting Trulioo verification for session ${session.sessionId}`);
        // Mock verification result for Trulioo (focuses on identity + sanctions/PEP)
        const confidence = Math.floor(Math.random() * 25) + 75; // 75-100%
        const passed = confidence > 80;
        const sanctionsHit = Math.random() < 0.05; // 5% chance of sanctions hit
        const pepHit = Math.random() < 0.03; // 3% chance of PEP hit
        return {
            sessionId: session.sessionId,
            provider: this.provider,
            status: (passed && !sanctionsHit && !pepHit) ? 'completed' : 'failed',
            confidence,
            user: {
                id: session.userId,
                firstName: 'Mock',
                lastName: 'User'
            },
            document: {
                type: session.documentType || 'national_id',
                verified: false, // Trulioo doesn't do document scanning
                extractedData: {},
                confidence: 0
            },
            biometric: {
                type: 'none',
                verified: false,
                confidence: 0
            },
            checks: {
                documentAuthenticity: {
                    status: 'not_applicable',
                    confidence: 0,
                    details: 'Trulioo does not verify document authenticity'
                },
                faceMatch: {
                    status: 'not_applicable',
                    confidence: 0,
                    details: 'Trulioo does not perform facial recognition'
                },
                addressVerification: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence,
                    details: 'Address verification against public records'
                },
                identityVerification: {
                    status: passed ? 'pass' : 'fail',
                    confidence: confidence,
                    details: 'Identity verification against government databases'
                },
                livenessDetection: {
                    status: 'not_applicable',
                    confidence: 0,
                    details: 'Trulioo does not perform liveness detection'
                },
                sanctions: {
                    status: sanctionsHit ? 'fail' : 'pass',
                    confidence: sanctionsHit ? 95 : confidence,
                    details: sanctionsHit ? 'Match found in sanctions list' : 'No sanctions matches found'
                },
                pep: {
                    status: pepHit ? 'fail' : 'pass',
                    confidence: pepHit ? 95 : confidence,
                    details: pepHit ? 'Match found in PEP list' : 'No PEP matches found'
                }
            },
            riskAssessment: {
                level: (sanctionsHit || pepHit) ? 'critical' :
                    confidence > 90 ? 'low' :
                        confidence > 75 ? 'medium' : 'high',
                score: (sanctionsHit || pepHit) ? 90 : 100 - confidence,
                reasons: [
                    ...(sanctionsHit ? ['Sanctions list match'] : []),
                    ...(pepHit ? ['PEP list match'] : []),
                    ...(!passed ? ['Identity verification failed'] : [])
                ]
            },
            providerResponse: {
                rawResponse: {
                    mock: true,
                    sanctionsHit,
                    pepHit,
                    identityVerified: passed
                },
                providerSessionId: `trulioo_${Date.now()}`,
                providerStatus: passed ? 'VERIFIED' : 'NOT_VERIFIED',
                timestamp: new Date().toISOString()
            },
            metadata: {
                processingTime: 1800, // Faster than document-based verification
                ipAddress: session.metadata.ipAddress,
                userAgent: session.metadata.userAgent,
                location: {
                    country: session.countryCode || 'Unknown'
                }
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
            configuration: !!environment_1.default.kycProviders.trulioo.apiKey,
            capabilities: {
                identityVerification: true,
                sanctionsScreening: true,
                pepScreening: true,
                addressVerification: true,
                documentVerification: false,
                biometricVerification: false
            },
            supportedCountries: this.config.supportedCountries.length,
            lastChecked: new Date().toISOString()
        };
    }
}
exports.TruliooService = TruliooService;
//# sourceMappingURL=truliooService.js.map
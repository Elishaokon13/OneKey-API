// OneKey KYC API - Onfido Service

import { BaseKycService } from './baseKycService';
import {
  KycSession,
  KycVerificationResult,
  CreateKycSessionRequest,
  KycProvider,
  KycProviderConfig,
  KycProviderError
} from '@/types/kyc';
import { config } from '../../config/environment';

export class OnfidoService extends BaseKycService {
  provider: KycProvider = 'onfido';

  constructor() {
    const providerConfig: KycProviderConfig = {
      provider: 'onfido',
      enabled: !!config.kycProviders.onfido.apiKey,
      priority: 2,
      config: {
        apiKey: config.kycProviders.onfido.apiKey,
        baseUrl: 'https://api.onfido.com/v3.6',
        testMode: config.server.nodeEnv !== 'production'
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

  protected async createProviderSession(session: KycSession, request: CreateKycSessionRequest): Promise<void> {
    console.log(`📄 Creating Onfido session for ${session.sessionId}`);
    
    if (!this.config.enabled) {
      throw new KycProviderError(
        'Onfido service is not configured',
        this.provider,
        'SERVICE_DISABLED',
        'API key not provided'
      );
    }
  }

  protected async performVerification(session: KycSession): Promise<KycVerificationResult> {
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
      expiresAt: session.expiresAt!
    };
  }

  protected async checkProviderHealth(): Promise<Record<string, any>> {
    return {
      status: this.config.enabled ? 'operational' : 'disabled',
      apiConnectivity: this.config.enabled,
      configuration: !!config.kycProviders.onfido.apiKey,
      supportedCountries: this.config.supportedCountries.length,
      lastChecked: new Date().toISOString()
    };
  }
}
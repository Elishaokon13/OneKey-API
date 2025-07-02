// OneKey KYC API - Smile Identity Service

import { BaseKycService } from './baseKycService';
import {
  KycSession,
  KycVerificationResult,
  CreateKycSessionRequest,
  KycProvider,
  KycProviderConfig,
  KycProviderError,
  SmileIdentityRequest,
  SmileIdentityResult
} from '@/types/kyc';
import { config } from '../../config/environment';

export class SmileIdentityService extends BaseKycService {
  provider: KycProvider = 'smile_identity';

  constructor() {
    const providerConfig: KycProviderConfig = {
      provider: 'smile_identity',
      enabled: !!config.kycProviders.smileIdentity.apiKey,
      priority: 1,
      config: {
        apiKey: config.kycProviders.smileIdentity.apiKey,
        baseUrl: 'https://3eydmgh10d.execute-api.us-west-2.amazonaws.com/test',
        testMode: config.server.nodeEnv !== 'production'
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

  protected async createProviderSession(session: KycSession, request: CreateKycSessionRequest): Promise<void> {
    console.log(`📄 Creating Smile Identity session for ${session.sessionId}`);
    
    if (!this.config.enabled) {
      throw new KycProviderError(
        'Smile Identity service is not configured',
        this.provider,
        'SERVICE_DISABLED',
        'API key not provided'
      );
    }
  }

  protected async performVerification(session: KycSession): Promise<KycVerificationResult> {
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
      expiresAt: session.expiresAt!
    };
  }

  protected async checkProviderHealth(): Promise<Record<string, any>> {
    return {
      status: this.config.enabled ? 'operational' : 'disabled',
      apiConnectivity: this.config.enabled,
      configuration: !!config.kycProviders.smileIdentity.apiKey,
      supportedCountries: this.config.supportedCountries.length,
      lastChecked: new Date().toISOString()
    };
  }
}
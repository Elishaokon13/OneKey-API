// OneKey KYC API - Main KYC Service Manager

import { BaseKycService } from './baseKycService';
import { SmileIdentityService } from './smileIdentityService';
import { OnfidoService } from './onfidoService';
import { TruliooService } from './truliooService';
import {
  KycSession,
  KycVerificationResult,
  CreateKycSessionRequest,
  UpdateKycSessionRequest,
  KycProvider,
  KycProviderConfig,
  KycProviderUnavailableError
} from '@/types/kyc';

export class KycService {
  private providers: Map<KycProvider, BaseKycService> = new Map();

  constructor() {
    this.initializeProviders();
    console.log('🔧 KYC Service Manager initialized');
  }

  private initializeProviders(): void {
    console.log('🚀 Initializing KYC providers...');

    // Initialize Smile Identity
    const smileService = new SmileIdentityService();
    this.providers.set('smile_identity', smileService);

    // Initialize Onfido  
    const onfidoService = new OnfidoService();
    this.providers.set('onfido', onfidoService);

    // Initialize Trulioo
    const truliooService = new TruliooService();
    this.providers.set('trulioo', truliooService);

    const enabledCount = Array.from(this.providers.values())
      .filter(p => p.getProviderConfig().enabled).length;
    
    console.log(`📊 KYC providers initialized: ${enabledCount}/${this.providers.size} enabled`);
  }

  selectProvider(request: CreateKycSessionRequest): KycProvider {
    const availableProviders = Array.from(this.providers.entries())
      .filter(([_, service]) => service.getProviderConfig().enabled)
      .sort(([_, a], [__, b]) => a.getProviderConfig().priority - b.getProviderConfig().priority);

    if (availableProviders.length === 0) {
      throw new KycProviderUnavailableError('smile_identity', 'No KYC providers are enabled');
    }

    return availableProviders[0][0];
  }

  async createSession(request: CreateKycSessionRequest): Promise<KycSession> {
    const provider = request.provider || this.selectProvider(request);
    const service = this.getProviderService(provider);
    return service.createSession({ ...request, provider });
  }

  async startVerification(sessionId: string): Promise<KycVerificationResult> {
    // Find which provider owns this session
    for (const service of this.providers.values()) {
      try {
        const session = await service.getSession(sessionId);
        if (session) {
          return service.startVerification(sessionId);
        }
      } catch (error) {
        // Session not found in this provider, continue
        continue;
      }
    }
    throw new Error(`Session ${sessionId} not found in any provider`);
  }

  getAvailableProviders(): KycProviderConfig[] {
    return Array.from(this.providers.values())
      .map(service => service.getProviderConfig())
      .filter(config => config.enabled)
      .sort((a, b) => a.priority - b.priority);
  }

  async getProvidersHealth(): Promise<Record<KycProvider, any>> {
    const healthChecks: Record<string, any> = {};

    for (const [provider, service] of this.providers.entries()) {
      try {
        healthChecks[provider] = await service.healthCheck();
      } catch (error) {
        healthChecks[provider] = {
          status: 'unhealthy',
          details: { error: (error as Error).message }
        };
      }
    }

    return healthChecks;
  }

  private getProviderService(provider: KycProvider): BaseKycService {
    const service = this.providers.get(provider);
    if (!service) {
      throw new KycProviderUnavailableError(provider);
    }
    return service;
  }
}
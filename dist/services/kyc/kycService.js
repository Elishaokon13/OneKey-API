"use strict";
// OneKey KYC API - Main KYC Service Manager
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const smileIdentityService_1 = require("./smileIdentityService");
const onfidoService_1 = require("./onfidoService");
const truliooService_1 = require("./truliooService");
const kyc_1 = require("@/types/kyc");
class KycService {
    providers = new Map();
    constructor() {
        this.initializeProviders();
        console.log('🔧 KYC Service Manager initialized');
    }
    initializeProviders() {
        console.log('🚀 Initializing KYC providers...');
        // Initialize Smile Identity
        const smileService = new smileIdentityService_1.SmileIdentityService();
        this.providers.set('smile_identity', smileService);
        // Initialize Onfido  
        const onfidoService = new onfidoService_1.OnfidoService();
        this.providers.set('onfido', onfidoService);
        // Initialize Trulioo
        const truliooService = new truliooService_1.TruliooService();
        this.providers.set('trulioo', truliooService);
        const enabledCount = Array.from(this.providers.values())
            .filter(p => p.getProviderConfig().enabled).length;
        console.log(`📊 KYC providers initialized: ${enabledCount}/${this.providers.size} enabled`);
    }
    selectProvider(request) {
        const availableProviders = Array.from(this.providers.entries())
            .filter(([_, service]) => service.getProviderConfig().enabled)
            .sort(([_, a], [__, b]) => a.getProviderConfig().priority - b.getProviderConfig().priority);
        if (availableProviders.length === 0) {
            throw new kyc_1.KycProviderUnavailableError('smile_identity', 'No KYC providers are enabled');
        }
        const selectedProvider = availableProviders[0];
        if (!selectedProvider) {
            throw new kyc_1.KycProviderUnavailableError('smile_identity', 'No KYC providers are enabled');
        }
        return selectedProvider[0];
    }
    async createSession(request) {
        const provider = request.provider || this.selectProvider(request);
        const service = this.getProviderService(provider);
        return service.createSession({ ...request, provider });
    }
    async startVerification(sessionId) {
        // Find which provider owns this session
        for (const service of this.providers.values()) {
            try {
                const session = await service.getSession(sessionId);
                if (session) {
                    return service.startVerification(sessionId);
                }
            }
            catch (error) {
                // Session not found in this provider, continue
                continue;
            }
        }
        throw new Error(`Session ${sessionId} not found in any provider`);
    }
    getAvailableProviders() {
        return Array.from(this.providers.values())
            .map(service => service.getProviderConfig())
            .filter(config => config.enabled)
            .sort((a, b) => a.priority - b.priority);
    }
    async getProvidersHealth() {
        const healthChecks = {};
        for (const [provider, service] of this.providers.entries()) {
            try {
                healthChecks[provider] = await service.healthCheck();
            }
            catch (error) {
                healthChecks[provider] = {
                    status: 'unhealthy',
                    details: { error: error.message }
                };
            }
        }
        return healthChecks;
    }
    getProviderService(provider) {
        const service = this.providers.get(provider);
        if (!service) {
            throw new kyc_1.KycProviderUnavailableError(provider);
        }
        return service;
    }
}
exports.KycService = KycService;
//# sourceMappingURL=kycService.js.map
"use strict";
// OneKey KYC API - Base KYC Service
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseKycService = void 0;
const kyc_1 = require("@/types/kyc");
const uuid_1 = require("uuid");
class BaseKycService {
    config;
    sessions = new Map();
    constructor(config) {
        this.config = config;
    }
    async createSession(request) {
        const sessionId = this.generateSessionId();
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        const session = {
            id: (0, uuid_1.v4)(),
            userId: request.user.id,
            sessionId,
            provider: this.provider,
            status: 'pending',
            ...(request.user.address?.country && { countryCode: request.user.address.country }),
            ...(request.document?.type && { documentType: request.document.type }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            metadata: request.metadata || {}
        };
        this.sessions.set(sessionId, session);
        await this.createProviderSession(session, request);
        return session;
    }
    async getSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new kyc_1.KycSessionNotFoundError(sessionId);
        }
        return session;
    }
    async updateSession(sessionId, updates) {
        const session = await this.getSession(sessionId);
        const updatedSession = { ...session, ...updates, updatedAt: new Date().toISOString() };
        this.sessions.set(sessionId, updatedSession);
        return updatedSession;
    }
    async startVerification(sessionId) {
        const session = await this.getSession(sessionId);
        await this.updateSession(sessionId, { status: 'processing' });
        return this.performVerification(session);
    }
    async healthCheck() {
        try {
            const details = await this.checkProviderHealth();
            return { status: 'healthy', details };
        }
        catch (error) {
            return { status: 'unhealthy', details: { error: error.message } };
        }
    }
    generateSessionId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `${this.provider}_${timestamp}_${random}`;
    }
    getProviderConfig() {
        return this.config;
    }
}
exports.BaseKycService = BaseKycService;
//# sourceMappingURL=baseKycService.js.map
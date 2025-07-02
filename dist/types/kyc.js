"use strict";
// OneKey KYC API - KYC Types
// Comprehensive interfaces for multi-provider KYC verification
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycProviderUnavailableError = exports.KycSessionNotFoundError = exports.KycValidationError = exports.KycProviderError = exports.KycError = void 0;
// ===== Error Classes =====
class KycError extends Error {
    code;
    provider;
    sessionId;
    details;
    constructor(message, code, provider, sessionId, details) {
        super(message);
        this.code = code;
        this.provider = provider;
        this.sessionId = sessionId;
        this.details = details;
        this.name = 'KycError';
    }
}
exports.KycError = KycError;
class KycProviderError extends KycError {
    provider;
    providerCode;
    providerMessage;
    constructor(message, provider, providerCode, providerMessage, sessionId) {
        super(message, 'KYC_PROVIDER_ERROR', provider, sessionId, {
            providerCode,
            providerMessage
        });
        this.provider = provider;
        this.providerCode = providerCode;
        this.providerMessage = providerMessage;
        this.name = 'KycProviderError';
    }
}
exports.KycProviderError = KycProviderError;
class KycValidationError extends KycError {
    field;
    value;
    constructor(message, field, value, sessionId) {
        super(message, 'KYC_VALIDATION_ERROR', undefined, sessionId, {
            field,
            value
        });
        this.field = field;
        this.value = value;
        this.name = 'KycValidationError';
    }
}
exports.KycValidationError = KycValidationError;
class KycSessionNotFoundError extends KycError {
    constructor(sessionId) {
        super(`KYC session not found: ${sessionId}`, 'KYC_SESSION_NOT_FOUND', undefined, sessionId);
        this.name = 'KycSessionNotFoundError';
    }
}
exports.KycSessionNotFoundError = KycSessionNotFoundError;
class KycProviderUnavailableError extends KycError {
    constructor(provider, reason) {
        super(`KYC provider ${provider} is currently unavailable${reason ? `: ${reason}` : ''}`, 'KYC_PROVIDER_UNAVAILABLE', provider);
        this.name = 'KycProviderUnavailableError';
    }
}
exports.KycProviderUnavailableError = KycProviderUnavailableError;
//# sourceMappingURL=kyc.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivySessionError = exports.PrivyVerificationError = exports.PrivyAuthenticationError = void 0;
// Error types for Privy authentication
class PrivyAuthenticationError extends Error {
    code;
    constructor(message, code = 'PRIVY_AUTH_ERROR') {
        super(message);
        this.code = code;
        this.name = 'PrivyAuthenticationError';
    }
}
exports.PrivyAuthenticationError = PrivyAuthenticationError;
class PrivyVerificationError extends Error {
    code;
    constructor(message, code = 'PRIVY_VERIFICATION_ERROR') {
        super(message);
        this.code = code;
        this.name = 'PrivyVerificationError';
    }
}
exports.PrivyVerificationError = PrivyVerificationError;
class PrivySessionError extends Error {
    code;
    constructor(message, code = 'PRIVY_SESSION_ERROR') {
        super(message);
        this.code = code;
        this.name = 'PrivySessionError';
    }
}
exports.PrivySessionError = PrivySessionError;
//# sourceMappingURL=privy.js.map
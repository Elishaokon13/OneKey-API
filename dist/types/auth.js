"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidTokenError = exports.TokenExpiredError = exports.AuthorizationError = exports.AuthenticationError = void 0;
// Error types for authentication
class AuthenticationError extends Error {
    code;
    constructor(message, code = 'AUTH_ERROR') {
        super(message);
        this.code = code;
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends Error {
    code;
    constructor(message, code = 'AUTHZ_ERROR') {
        super(message);
        this.code = code;
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class TokenExpiredError extends Error {
    constructor(message = 'Token has expired') {
        super(message);
        this.name = 'TokenExpiredError';
    }
}
exports.TokenExpiredError = TokenExpiredError;
class InvalidTokenError extends Error {
    constructor(message = 'Invalid token provided') {
        super(message);
        this.name = 'InvalidTokenError';
    }
}
exports.InvalidTokenError = InvalidTokenError;
//# sourceMappingURL=auth.js.map
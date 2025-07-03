"use strict";
/**
 * OneKey KYC API - Encryption Types
 *
 * Defines types for client-side encryption utilities and key management.
 * Supports AES-256-GCM encryption with secure key derivation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrityError = exports.KeyManagementError = exports.DecryptionError = exports.EncryptionError = void 0;
// ===== Error Types =====
class EncryptionError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'EncryptionError';
    }
}
exports.EncryptionError = EncryptionError;
class DecryptionError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DecryptionError';
    }
}
exports.DecryptionError = DecryptionError;
class KeyManagementError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'KeyManagementError';
    }
}
exports.KeyManagementError = KeyManagementError;
class IntegrityError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'IntegrityError';
    }
}
exports.IntegrityError = IntegrityError;
//# sourceMappingURL=encryption.js.map
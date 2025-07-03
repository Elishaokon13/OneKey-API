"use strict";
// OneKey KYC API - EAS Attestation Types
// Ethereum Attestation Service integration for KYC verification proofs
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainError = exports.SchemaError = exports.AttestationNotFoundError = exports.AttestationVerificationError = exports.AttestationCreationError = exports.AttestationError = void 0;
// ===== Error Classes =====
class AttestationError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'AttestationError';
    }
}
exports.AttestationError = AttestationError;
class AttestationCreationError extends AttestationError {
    transactionHash;
    gasUsed;
    constructor(message, transactionHash, gasUsed, details) {
        super(message, 'ATTESTATION_CREATION_FAILED', details);
        this.transactionHash = transactionHash;
        this.gasUsed = gasUsed;
        this.name = 'AttestationCreationError';
    }
}
exports.AttestationCreationError = AttestationCreationError;
class AttestationVerificationError extends AttestationError {
    uid;
    constructor(message, uid, details) {
        super(message, 'ATTESTATION_VERIFICATION_FAILED', details);
        this.uid = uid;
        this.name = 'AttestationVerificationError';
    }
}
exports.AttestationVerificationError = AttestationVerificationError;
class AttestationNotFoundError extends AttestationError {
    constructor(uid) {
        super(`Attestation not found: ${uid}`, 'ATTESTATION_NOT_FOUND', { uid });
        this.name = 'AttestationNotFoundError';
    }
}
exports.AttestationNotFoundError = AttestationNotFoundError;
class SchemaError extends AttestationError {
    schemaId;
    constructor(message, schemaId, details) {
        super(message, 'SCHEMA_ERROR', details);
        this.schemaId = schemaId;
        this.name = 'SchemaError';
    }
}
exports.SchemaError = SchemaError;
class BlockchainError extends AttestationError {
    chainId;
    blockNumber;
    constructor(message, chainId, blockNumber, details) {
        super(message, 'BLOCKCHAIN_ERROR', details);
        this.chainId = chainId;
        this.blockNumber = blockNumber;
        this.name = 'BlockchainError';
    }
}
exports.BlockchainError = BlockchainError;
//# sourceMappingURL=attestation.js.map
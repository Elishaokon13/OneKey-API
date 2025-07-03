"use strict";
// OneKey KYC API - Arweave Storage Types
// Basic interfaces for permanent decentralized storage
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArweaveWalletError = exports.ArweaveRetrievalError = exports.ArweaveUploadError = exports.ArweaveError = void 0;
// Error Classes
class ArweaveError extends Error {
    code;
    transactionId;
    details;
    constructor(message, code, transactionId, details) {
        super(message);
        this.code = code;
        this.transactionId = transactionId;
        this.details = details;
        this.name = 'ArweaveError';
    }
}
exports.ArweaveError = ArweaveError;
class ArweaveUploadError extends ArweaveError {
    dataSize;
    cost;
    constructor(message, dataSize, cost, details) {
        super(message, 'UPLOAD_FAILED', undefined, details);
        this.dataSize = dataSize;
        this.cost = cost;
        this.name = 'ArweaveUploadError';
    }
}
exports.ArweaveUploadError = ArweaveUploadError;
class ArweaveRetrievalError extends ArweaveError {
    transactionId;
    gateway;
    constructor(message, transactionId, gateway, details) {
        super(message, 'RETRIEVAL_FAILED', transactionId, details);
        this.transactionId = transactionId;
        this.gateway = gateway;
        this.name = 'ArweaveRetrievalError';
    }
}
exports.ArweaveRetrievalError = ArweaveRetrievalError;
class ArweaveWalletError extends ArweaveError {
    walletAddress;
    constructor(message, walletAddress, details) {
        super(message, 'WALLET_ERROR', undefined, details);
        this.walletAddress = walletAddress;
        this.name = 'ArweaveWalletError';
    }
}
exports.ArweaveWalletError = ArweaveWalletError;
//# sourceMappingURL=arweave.js.map
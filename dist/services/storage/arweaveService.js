"use strict";
// OneKey KYC API - Arweave Service Implementation
// Permanent decentralized storage for attestation metadata and critical documents
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArweaveService = void 0;
const arweave_1 = __importDefault(require("arweave"));
const crypto_1 = __importDefault(require("crypto"));
const uuid_1 = require("uuid");
const arweave_2 = require("../../types/arweave");
const logger_1 = require("../../utils/logger");
class ArweaveService {
    arweave;
    wallet = null;
    config;
    cache = new Map();
    stats;
    constructor(arweaveConfig) {
        this.config = arweaveConfig;
        this.initializeArweave();
        this.initializeStats();
    }
    // ===== Initialization =====
    initializeArweave() {
        try {
            this.arweave = arweave_1.default.init({
                host: this.config.host,
                port: this.config.port,
                protocol: this.config.protocol,
                timeout: this.config.timeout,
                logging: this.config.logging
            });
            logger_1.logger.info('Arweave service initialized', {
                host: this.config.host,
                port: this.config.port,
                protocol: this.config.protocol
            });
            // Initialize wallet if provided
            this.initializeWallet();
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Arweave service', { error });
            throw new arweave_2.ArweaveError('Arweave service initialization failed', 'INITIALIZATION_FAILED', undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async initializeWallet() {
        try {
            if (this.config.wallet.keyFile) {
                // Load wallet from file
                const fs = await Promise.resolve().then(() => __importStar(require('fs')));
                const walletData = JSON.parse(fs.readFileSync(this.config.wallet.keyFile, 'utf8'));
                this.wallet = walletData;
            }
            else if (this.config.wallet.keyData) {
                // Use provided wallet data
                this.wallet = this.config.wallet.keyData;
            }
            if (this.wallet) {
                const address = await this.arweave.wallets.jwkToAddress(this.wallet);
                logger_1.logger.info('Arweave wallet initialized', { address });
            }
            else {
                logger_1.logger.warn('No Arweave wallet configured - read-only mode');
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize Arweave wallet', { error });
            throw new arweave_2.ArweaveWalletError('Wallet initialization failed', this.config.wallet.address, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    initializeStats() {
        this.stats = {
            totalUploads: 0,
            totalRetrievals: 0,
            totalDataStored: 0,
            totalCost: '0',
            averageUploadTime: 0,
            averageRetrievalTime: 0,
            successRate: 100,
            storageByCategory: {
                kyc_document: 0,
                attestation_metadata: 0,
                audit_log: 0,
                backup: 0,
                other: 0
            },
            monthlyUsage: []
        };
    }
    // ===== Storage Operations =====
    async uploadData(request) {
        const startTime = Date.now();
        const requestId = (0, uuid_1.v4)();
        try {
            if (!this.wallet) {
                throw new arweave_2.ArweaveWalletError('No wallet configured for upload');
            }
            logger_1.logger.info('Starting Arweave upload', {
                requestId,
                dataSize: request.data.length,
                contentType: request.contentType,
                permanent: request.permanent
            });
            // Create transaction
            const transaction = await this.arweave.createTransaction({
                data: request.data
            }, this.wallet);
            // Add tags
            for (const tag of request.tags) {
                transaction.addTag(tag.name, tag.value);
            }
            // Add metadata tags
            if (request.metadata) {
                transaction.addTag('Content-Type', request.contentType);
                transaction.addTag('OneKey-Category', request.metadata.category);
                transaction.addTag('OneKey-Uploaded-By', request.metadata.uploadedBy);
                transaction.addTag('OneKey-Data-Hash', request.metadata.dataHash);
                if (request.metadata.description) {
                    transaction.addTag('OneKey-Description', request.metadata.description);
                }
            }
            // Add permanent storage tag if requested
            if (request.permanent) {
                transaction.addTag('OneKey-Permanent', 'true');
            }
            // Sign transaction
            await this.arweave.transactions.sign(transaction, this.wallet);
            // Get cost
            const cost = await this.arweave.transactions.getPrice(parseInt(transaction.data_size));
            // Submit transaction
            const uploader = await this.arweave.transactions.getUploader(transaction);
            while (!uploader.isComplete) {
                await uploader.uploadChunk();
                logger_1.logger.debug('Upload progress', {
                    requestId,
                    uploaded: uploader.uploadedChunks,
                    total: uploader.totalChunks,
                    percentage: Math.round((uploader.uploadedChunks / uploader.totalChunks) * 100)
                });
            }
            const processingTime = Date.now() - startTime;
            // Create response
            const response = {
                transactionId: transaction.id,
                dataSize: parseInt(transaction.data_size),
                cost: this.arweave.ar.winstonToAr(cost),
                permanent: request.permanent || false,
                tags: request.tags,
                metadata: {
                    ...request.metadata,
                    uploadTimestamp: new Date().toISOString()
                },
                uploadTimestamp: new Date().toISOString(),
                confirmationStatus: 'pending',
                estimatedConfirmationTime: this.estimateConfirmationTime(parseInt(transaction.data_size)),
                arweaveUrl: `https://arweave.net/${transaction.id}`,
                gatewayUrls: this.config.gatewayUrls.map(gateway => `${gateway}/${transaction.id}`)
            };
            // Update statistics
            this.updateUploadStats(parseInt(transaction.data_size), processingTime, true);
            logger_1.logger.info('Arweave upload completed', {
                requestId,
                transactionId: transaction.id,
                dataSize: response.dataSize,
                cost: response.cost,
                processingTime
            });
            return response;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateUploadStats(0, processingTime, false);
            logger_1.logger.error('Arweave upload failed', {
                requestId,
                error: error instanceof Error ? error.message : String(error),
                processingTime
            });
            if (error instanceof arweave_2.ArweaveError) {
                throw error;
            }
            throw new arweave_2.ArweaveUploadError('Upload failed', typeof request.data === 'string' ? request.data.length : request.data.byteLength, undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async retrieveData(request) {
        const startTime = Date.now();
        const requestId = (0, uuid_1.v4)();
        try {
            logger_1.logger.info('Starting Arweave retrieval', {
                requestId,
                transactionId: request.transactionId
            });
            // Check cache first
            const cacheKey = `retrieve_${request.transactionId}`;
            if (this.config.caching.enabled && this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey);
                logger_1.logger.debug('Data retrieved from cache', { requestId, transactionId: request.transactionId });
                return {
                    ...cachedData,
                    retrievalTimestamp: new Date().toISOString(),
                    fromCache: true
                };
            }
            // Try multiple gateways
            const gatewayUrls = request.preferredGateway
                ? [request.preferredGateway, ...this.config.gatewayUrls]
                : this.config.gatewayUrls;
            let transaction = null;
            let data = null;
            let usedGateway = '';
            for (const gateway of gatewayUrls) {
                try {
                    // Get transaction details
                    transaction = await this.arweave.transactions.get(request.transactionId);
                    // Get data
                    const response = await fetch(`${gateway}/${request.transactionId}`);
                    if (response.ok) {
                        data = Buffer.from(await response.arrayBuffer());
                        usedGateway = gateway;
                        break;
                    }
                }
                catch (error) {
                    logger_1.logger.debug('Gateway failed', { gateway, error: error instanceof Error ? error.message : String(error) });
                    continue;
                }
            }
            if (!transaction || !data) {
                throw new arweave_2.ArweaveRetrievalError('Failed to retrieve data from all gateways', request.transactionId, usedGateway);
            }
            // Process tags
            const tags = transaction.tags.map((tag) => ({
                name: tag.name,
                value: tag.value
            }));
            // Extract metadata from tags
            const metadata = {
                uploadedBy: tags.find(t => t.name === 'OneKey-Uploaded-By')?.value || '',
                uploadTimestamp: tags.find(t => t.name === 'OneKey-Uploaded-Timestamp')?.value || '',
                dataHash: tags.find(t => t.name === 'OneKey-Data-Hash')?.value || '',
                category: (tags.find(t => t.name === 'OneKey-Category')?.value || 'other'),
                ...(tags.find(t => t.name === 'OneKey-Description')?.value && {
                    description: tags.find(t => t.name === 'OneKey-Description').value
                })
            };
            // Verify integrity if requested
            let verified = false;
            if (request.verifyIntegrity && metadata.dataHash) {
                const computedHash = crypto_1.default.createHash('sha256').update(data).digest('hex');
                verified = computedHash === metadata.dataHash;
            }
            const processingTime = Date.now() - startTime;
            const response = {
                transactionId: request.transactionId,
                data: data,
                contentType: tags.find(t => t.name === 'Content-Type')?.value || 'application/octet-stream',
                tags,
                metadata,
                size: data.length,
                retrievalTimestamp: new Date().toISOString(),
                dataHash: metadata.dataHash,
                verified,
                fromCache: false
            };
            // Cache the response
            if (this.config.caching.enabled) {
                this.cache.set(cacheKey, response);
                // Clean up cache if it gets too large
                if (this.cache.size > this.config.caching.maxSize) {
                    const firstKey = this.cache.keys().next().value;
                    if (firstKey) {
                        this.cache.delete(firstKey);
                    }
                }
            }
            // Update statistics
            this.updateRetrievalStats(data.length, processingTime, true);
            logger_1.logger.info('Arweave retrieval completed', {
                requestId,
                transactionId: request.transactionId,
                dataSize: response.size,
                verified,
                processingTime
            });
            return response;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            this.updateRetrievalStats(0, processingTime, false);
            logger_1.logger.error('Arweave retrieval failed', {
                requestId,
                transactionId: request.transactionId,
                error: error instanceof Error ? error.message : String(error),
                processingTime
            });
            if (error instanceof arweave_2.ArweaveError) {
                throw error;
            }
            throw new arweave_2.ArweaveRetrievalError('Retrieval failed', request.transactionId, request.preferredGateway, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Health and Status =====
    async getHealthStatus() {
        try {
            const startTime = Date.now();
            // Get network info
            const networkInfo = await this.arweave.network.getInfo();
            // Get wallet info if available
            let walletBalance = '0';
            let walletAddress = '';
            if (this.wallet) {
                walletAddress = await this.arweave.wallets.jwkToAddress(this.wallet);
                const balance = await this.arweave.wallets.getBalance(walletAddress);
                walletBalance = this.arweave.ar.winstonToAr(balance);
            }
            // Check gateway status
            const gatewayStatus = {};
            for (const gateway of this.config.gatewayUrls) {
                try {
                    const response = await fetch(`${gateway}/info`, {
                        signal: AbortSignal.timeout(5000)
                    });
                    gatewayStatus[gateway] = response.ok;
                }
                catch {
                    gatewayStatus[gateway] = false;
                }
            }
            return {
                connected: true,
                networkInfo,
                walletBalance,
                walletAddress,
                nodeVersion: networkInfo.version.toString(),
                lastBlockTime: new Date().toISOString(),
                syncStatus: 'synced',
                gatewayStatus,
                averageUploadTime: this.stats.averageUploadTime,
                averageRetrievalTime: this.stats.averageRetrievalTime,
                totalTransactions: this.stats.totalUploads + this.stats.totalRetrievals,
                failureRate: Math.round(((1 - this.stats.successRate / 100) * 100) * 100) / 100,
                lastHealthCheck: new Date().toISOString()
            };
        }
        catch (error) {
            logger_1.logger.error('Health check failed', {
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                connected: false,
                networkInfo: {},
                walletBalance: '0',
                walletAddress: '',
                nodeVersion: 'unknown',
                lastBlockTime: new Date().toISOString(),
                syncStatus: 'error',
                gatewayStatus: {},
                averageUploadTime: 0,
                averageRetrievalTime: 0,
                totalTransactions: 0,
                failureRate: 100,
                lastHealthCheck: new Date().toISOString()
            };
        }
    }
    // ===== Integration Methods =====
    async storeAttestationData(attestationId, metadata, documents) {
        try {
            logger_1.logger.info('Storing attestation data', { attestationId, documentCount: documents.length });
            // Upload metadata
            const metadataUpload = await this.uploadData({
                data: JSON.stringify(metadata),
                contentType: 'application/json',
                tags: [
                    { name: 'OneKey-Type', value: 'attestation-metadata' },
                    { name: 'OneKey-Attestation-ID', value: attestationId }
                ],
                metadata: {
                    uploadedBy: 'system',
                    uploadTimestamp: new Date().toISOString(),
                    dataHash: crypto_1.default.createHash('sha256').update(JSON.stringify(metadata)).digest('hex'),
                    category: 'attestation_metadata',
                    description: `Attestation metadata for ${attestationId}`
                },
                permanent: true
            });
            // Upload documents
            const documentUploads = await Promise.all(documents.map((doc, index) => this.uploadData({
                data: doc,
                contentType: 'application/octet-stream',
                tags: [
                    { name: 'OneKey-Type', value: 'attestation-document' },
                    { name: 'OneKey-Attestation-ID', value: attestationId },
                    { name: 'OneKey-Document-Index', value: index.toString() }
                ],
                metadata: {
                    uploadedBy: 'system',
                    uploadTimestamp: new Date().toISOString(),
                    dataHash: crypto_1.default.createHash('sha256').update(doc).digest('hex'),
                    category: 'kyc_document',
                    description: `Attestation document ${index + 1} for ${attestationId}`
                },
                permanent: true
            })));
            return {
                attestationId,
                metadataTransactionId: metadataUpload.transactionId,
                documentsTransactionIds: documentUploads.map(upload => upload.transactionId),
                storageTimestamp: new Date().toISOString(),
                permanent: true,
                totalCost: (parseFloat(metadataUpload.cost) + documentUploads.reduce((sum, upload) => sum + parseFloat(upload.cost), 0)).toString(),
                retrievalCount: 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to store attestation data', {
                attestationId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new arweave_2.ArweaveUploadError('Failed to store attestation data', undefined, undefined, { attestationId, error: error instanceof Error ? error.message : String(error) });
        }
    }
    async storeKycData(sessionId, encryptedData, documents) {
        try {
            logger_1.logger.info('Storing KYC data', { sessionId, documentCount: documents.length });
            // Upload encrypted KYC data
            const dataUpload = await this.uploadData({
                data: encryptedData,
                contentType: 'application/octet-stream',
                tags: [
                    { name: 'OneKey-Type', value: 'kyc-data' },
                    { name: 'OneKey-Session-ID', value: sessionId }
                ],
                metadata: {
                    uploadedBy: 'system',
                    uploadTimestamp: new Date().toISOString(),
                    dataHash: crypto_1.default.createHash('sha256').update(encryptedData).digest('hex'),
                    category: 'kyc_document',
                    description: `KYC data for session ${sessionId}`,
                    encryptionMethod: 'AES-256-GCM'
                },
                permanent: false // KYC data can expire
            });
            // Upload documents
            const documentUploads = await Promise.all(documents.map((doc, index) => this.uploadData({
                data: doc,
                contentType: 'application/octet-stream',
                tags: [
                    { name: 'OneKey-Type', value: 'kyc-document' },
                    { name: 'OneKey-Session-ID', value: sessionId },
                    { name: 'OneKey-Document-Index', value: index.toString() }
                ],
                metadata: {
                    uploadedBy: 'system',
                    uploadTimestamp: new Date().toISOString(),
                    dataHash: crypto_1.default.createHash('sha256').update(doc).digest('hex'),
                    category: 'kyc_document',
                    description: `KYC document ${index + 1} for session ${sessionId}`
                },
                permanent: false
            })));
            return {
                sessionId,
                encryptedDataTransactionId: dataUpload.transactionId,
                documentTransactionIds: documentUploads.map(upload => upload.transactionId),
                storageTimestamp: new Date().toISOString(),
                expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
                accessCount: 0
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to store KYC data', {
                sessionId,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new arweave_2.ArweaveUploadError('Failed to store KYC data', undefined, undefined, { sessionId, error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Utility Methods =====
    estimateConfirmationTime(dataSize) {
        // Rough estimation based on data size
        if (dataSize < 1024 * 1024)
            return 300; // 5 minutes for small files
        if (dataSize < 10 * 1024 * 1024)
            return 600; // 10 minutes for medium files
        return 1800; // 30 minutes for large files
    }
    updateUploadStats(dataSize, processingTime, success) {
        this.stats.totalUploads++;
        if (success) {
            this.stats.totalDataStored += dataSize;
            this.stats.averageUploadTime = (this.stats.averageUploadTime + processingTime) / 2;
        }
        this.stats.successRate = (this.stats.successRate + (success ? 100 : 0)) / 2;
    }
    updateRetrievalStats(dataSize, processingTime, success) {
        this.stats.totalRetrievals++;
        if (success) {
            this.stats.averageRetrievalTime = (this.stats.averageRetrievalTime + processingTime) / 2;
        }
        this.stats.successRate = (this.stats.successRate + (success ? 100 : 0)) / 2;
    }
    getStats() {
        return { ...this.stats };
    }
}
exports.ArweaveService = ArweaveService;
//# sourceMappingURL=arweaveService.js.map
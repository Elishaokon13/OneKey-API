"use strict";
// OneKey KYC API - EAS Service Implementation
// Ethereum Attestation Service integration for KYC verification proofs
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EasService = void 0;
const ethers_1 = require("ethers");
const eas_sdk_1 = require("@ethereum-attestation-service/eas-sdk");
const uuid_1 = require("uuid");
const crypto_1 = __importDefault(require("crypto"));
const baseAttestationService_1 = require("./baseAttestationService");
const schemaManager_1 = require("./schemaManager");
const arweaveService_1 = require("../storage/arweaveService");
const attestation_1 = require("../../types/attestation");
const logger_1 = require("../../utils/logger");
class EasService extends baseAttestationService_1.BaseAttestationService {
    arweaveConfig;
    eas;
    schemaEncoder;
    schemaManager;
    arweaveService;
    SCHEMA_DEFINITION = 'string kycProvider,string kycSessionId,string verificationStatus,uint256 verificationTimestamp,uint256 confidenceScore,string userIdHash,string countryCode,string documentType,bool documentVerified,bool biometricVerified,bool livenessVerified,bool addressVerified,bool sanctionsCleared,bool pepCleared,string riskLevel,uint256 riskScore,string schemaVersion,string apiVersion,string attestationStandard';
    constructor(easConfig, arweaveConfig // TODO: Add proper type
    ) {
        super(easConfig);
        this.arweaveConfig = arweaveConfig;
        if (arweaveConfig) {
            this.arweaveService = new arweaveService_1.ArweaveService(arweaveConfig);
        }
    }
    // ===== Provider Initialization =====
    async initializeProvider() {
        try {
            logger_1.logger.info('Initializing EAS provider', {
                chainId: this.config.chainId,
                rpcUrl: this.config.rpcUrl,
                contractAddress: this.config.contractAddress
            });
            // Initialize ethers provider
            this.provider = new ethers_1.ethers.JsonRpcProvider(this.config.rpcUrl);
            // Initialize signer
            this.signer = new ethers_1.ethers.Wallet(this.config.attesterPrivateKey, this.provider);
            // Verify signer address matches config
            const signerAddress = await this.signer.getAddress();
            if (signerAddress.toLowerCase() !== this.config.attesterAddress.toLowerCase()) {
                throw new Error(`Signer address mismatch: expected ${this.config.attesterAddress}, got ${signerAddress}`);
            }
            // Initialize EAS SDK
            this.eas = new eas_sdk_1.EAS(this.config.contractAddress);
            this.eas.connect(this.signer);
            // Initialize schema encoder
            this.schemaEncoder = new eas_sdk_1.SchemaEncoder(this.SCHEMA_DEFINITION);
            // Initialize schema manager
            const schemaConfig = {
                rpcUrl: this.config.rpcUrl,
                registryAddress: this.config.schemaRegistryAddress,
                privateKey: this.config.attesterPrivateKey,
                defaultResolver: this.config.contractAddress,
                caching: {
                    enabled: true,
                    ttl: 3600 // 1 hour
                }
            };
            this.schemaManager = new schemaManager_1.SchemaManager(schemaConfig);
            await this.schemaManager.initialize();
            // Verify schema exists and is valid
            await this.validateDefaultSchema();
            // Verify network connection
            const network = await this.provider.getNetwork();
            if (Number(network.chainId) !== this.config.chainId) {
                throw new Error(`Chain ID mismatch: expected ${this.config.chainId}, got ${network.chainId}`);
            }
            logger_1.logger.info('EAS provider initialized successfully', {
                chainId: Number(network.chainId),
                attesterAddress: signerAddress,
                blockNumber: await this.provider.getBlockNumber()
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize EAS provider', { error });
            throw new attestation_1.BlockchainError('EAS provider initialization failed', this.config.chainId, undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Schema Management =====
    async validateDefaultSchema() {
        try {
            const validation = await this.schemaManager.validateSchema(this.config.defaultSchemaId);
            if (!validation.valid) {
                throw new attestation_1.AttestationError('Default schema validation failed', 'SCHEMA_VALIDATION_FAILED', {
                    schemaId: this.config.defaultSchemaId,
                    errors: validation.errors,
                    warnings: validation.warnings
                });
            }
            logger_1.logger.info('Default schema validated successfully', {
                schemaId: this.config.defaultSchemaId,
                version: validation.version
            });
        }
        catch (error) {
            logger_1.logger.error('Schema validation failed', { error });
            throw new attestation_1.AttestationError('Schema validation failed', 'SCHEMA_VALIDATION_FAILED', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Attestation Creation =====
    async createAttestation(request) {
        try {
            // Transform KYC result to attestation data
            const attestationData = this.transformKycToAttestationData(request.kycResult, request.recipient);
            // Encode the attestation data
            const encodedData = this.encodeAttestationData(attestationData);
            // Prepare attestation request
            const attestationRequest = {
                schema: this.config.defaultSchemaId,
                data: {
                    recipient: request.recipient,
                    expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
                    revocable: request.options?.revocable ?? true,
                    data: encodedData,
                },
            };
            logger_1.logger.info('Creating EAS attestation', {
                recipient: request.recipient,
                schema: this.config.defaultSchemaId,
                expirationTime: attestationRequest.data.expirationTime.toString(),
                revocable: attestationRequest.data.revocable
            });
            // Create the attestation with retry mechanism
            const { transaction: tx, receipt } = await this.executeWithRetry(() => this.eas.attest(attestationRequest), 'Attestation creation');
            // Extract attestation UID from transaction logs
            const uid = await this.extractAttestationUid(receipt);
            // Get block information
            const block = await this.provider.getBlock(receipt.blockNumber);
            if (!block) {
                throw new attestation_1.BlockchainError('Block not found', this.config.chainId, receipt.blockNumber);
            }
            // Create attestation object
            const attestation = {
                id: (0, uuid_1.v4)(),
                uid,
                schemaId: this.config.defaultSchemaId,
                attester: this.config.attesterAddress,
                recipient: request.recipient,
                data: attestationData,
                encodedData,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                blockTimestamp: block.timestamp,
                chainId: this.config.chainId,
                status: 'confirmed',
                revoked: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Number(attestationRequest.data.expirationTime) * 1000).toISOString(),
                metadata: {
                    gasUsed: receipt.gasUsed.toString(),
                    gasPrice: receipt.gasPrice?.toString(),
                    requestId: request.requestId,
                    ...request.options?.onChainMetadata
                }
            };
            // Log successful creation
            this.logAttestationActivity('created', uid, this.config.attesterAddress, {
                kycProvider: attestationData.kycProvider,
                confidenceScore: attestationData.confidenceScore,
                gasUsed: receipt.gasUsed.toString()
            });
            // Store attestation in database
            await this.storeAttestation(attestation);
            return attestation;
        }
        catch (error) {
            logger_1.logger.error('Failed to create EAS attestation', {
                recipient: request.recipient,
                error: error instanceof Error ? error.message : String(error)
            });
            if (error instanceof attestation_1.AttestationError) {
                throw error;
            }
            throw new attestation_1.AttestationCreationError('EAS attestation creation failed', undefined, undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Batch Attestation =====
    async createBatchAttestations(requests) {
        try {
            // Validate all requests first
            await Promise.all(requests.map(request => this.validateRequest(request)));
            // Prepare all attestation requests
            const attestationRequests = await Promise.all(requests.map(async (request) => {
                const attestationData = this.transformKycToAttestationData(request.kycResult, request.recipient);
                const encodedData = this.encodeAttestationData(attestationData);
                const requestData = {
                    recipient: request.recipient,
                    expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
                    revocable: request.options?.revocable ?? true,
                    data: encodedData,
                };
                return {
                    schema: this.config.defaultSchemaId,
                    data: [requestData],
                    _requestMetadata: {
                        requestId: request.requestId || crypto_1.default.randomUUID(),
                        originalData: attestationData
                    }
                };
            }));
            // Create attestations in batches of 10
            const batchSize = 10;
            const attestations = [];
            for (let i = 0; i < attestationRequests.length; i += batchSize) {
                const batch = attestationRequests.slice(i, i + batchSize);
                // Create batch with retry
                const { transaction: tx, receipt } = await this.executeWithRetry(() => this.eas.multiAttest(batch), `Batch attestation ${i / batchSize + 1}`);
                // Process batch results
                const batchAttestations = await this.processBatchReceipt(receipt, batch);
                attestations.push(...batchAttestations);
            }
            // Store attestations
            await Promise.all(attestations.map(attestation => this.storeAttestation(attestation)));
            return attestations;
        }
        catch (error) {
            logger_1.logger.error('Batch attestation creation failed', { error });
            throw new attestation_1.AttestationCreationError('Batch attestation creation failed', undefined, undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async processBatchReceipt(receipt, requests) {
        const attestations = [];
        const block = await this.provider.getBlock(receipt.blockNumber);
        if (!block) {
            throw new attestation_1.BlockchainError('Block not found', this.config.chainId, receipt.blockNumber);
        }
        // Extract UIDs from logs
        const uids = this.extractBatchAttestationUids(receipt);
        // Create attestation objects
        for (let i = 0; i < uids.length; i++) {
            const uid = uids[i];
            const request = requests[i];
            if (!request || !request.data[0] || !uid) {
                throw new attestation_1.AttestationError('Invalid batch request data', 'INVALID_BATCH_DATA', { index: i });
            }
            // Get gas price safely
            let gasPrice = '0';
            if (receipt.gasPrice) {
                gasPrice = receipt.gasPrice.toString();
            }
            // Ensure metadata has required string values
            const metadata = {
                gasUsed: receipt.gasUsed.toString(),
                gasPrice,
                requestId: request._requestMetadata.requestId || crypto_1.default.randomUUID(),
                batchIndex: i.toString()
            };
            const attestation = {
                id: (0, uuid_1.v4)(),
                uid,
                schemaId: this.config.defaultSchemaId,
                attester: this.config.attesterAddress,
                recipient: request.data[0].recipient,
                data: request._requestMetadata.originalData,
                encodedData: request.data[0].data,
                transactionHash: receipt.hash,
                blockNumber: receipt.blockNumber,
                blockTimestamp: block.timestamp,
                chainId: this.config.chainId,
                status: 'confirmed',
                revoked: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                expiresAt: new Date(Number(request.data[0].expirationTime) * 1000).toISOString(),
                metadata
            };
            attestations.push(attestation);
        }
        return attestations;
    }
    extractBatchAttestationUids(receipt) {
        const uids = [];
        for (const log of receipt.logs) {
            try {
                const iface = new ethers_1.ethers.Interface([
                    'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 schema)'
                ]);
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'Attested') {
                    uids.push(parsed.args.uid);
                }
            }
            catch {
                // Skip logs that don't match the event
                continue;
            }
        }
        return uids;
    }
    // ===== Transaction Retry Logic =====
    async executeWithRetry(operation, operationName, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        let delay = initialDelay;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const tx = await operation();
                if (!tx) {
                    throw new Error(`${operationName} returned null transaction`);
                }
                // Wait for transaction confirmation
                const receipt = await tx.wait();
                if (!receipt) {
                    throw new Error(`${operationName} receipt not available`);
                }
                return { transaction: tx, receipt };
            }
            catch (error) {
                lastError = error;
                // Check if we should retry
                if (this.shouldRetry(error) && attempt < maxRetries) {
                    logger_1.logger.warn(`${operationName} attempt ${attempt} failed, retrying in ${delay}ms`, {
                        error: error instanceof Error ? error.message : String(error)
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                break;
            }
        }
        throw new attestation_1.AttestationError(`${operationName} failed after ${maxRetries} attempts`, 'MAX_RETRIES_EXCEEDED', { lastError: lastError?.message });
    }
    shouldRetry(error) {
        // Retry on network errors, nonce issues, or gas price errors
        const retryableErrors = [
            'nonce',
            'replacement fee too low',
            'network error',
            'timeout',
            'transaction underpriced',
            'already known'
        ];
        const errorMessage = error?.message?.toLowerCase() || '';
        return retryableErrors.some(msg => errorMessage.includes(msg));
    }
    // ===== Attestation Verification =====
    async verifyOnChain(uid) {
        try {
            logger_1.logger.info('Verifying attestation on-chain', { uid });
            const startTime = Date.now();
            // Get attestation from EAS
            const attestation = await this.eas.getAttestation(uid);
            if (!attestation) {
                throw new attestation_1.AttestationNotFoundError(uid);
            }
            // Verify attestation properties
            const verification = {
                onChain: true,
                schemaValid: attestation.schema === this.config.defaultSchemaId,
                notRevoked: !attestation.revocationTime || attestation.revocationTime === 0n,
                notExpired: attestation.expirationTime === 0n || attestation.expirationTime > BigInt(Math.floor(Date.now() / 1000)),
                attesterValid: attestation.attester.toLowerCase() === this.config.attesterAddress.toLowerCase(),
                recipientMatch: true // Will be validated by caller if needed
            };
            const valid = Object.values(verification).every(v => v === true);
            // Get current block for timestamp
            const currentBlock = await this.provider.getBlockNumber();
            const result = {
                valid,
                verification,
                details: {
                    checkedAt: new Date().toISOString(),
                    blockNumber: currentBlock,
                    verificationTime: Date.now() - startTime
                },
                ...(valid ? {} : { errors: this.getVerificationErrors(verification) })
            };
            // If verification passed, include full attestation data
            if (valid) {
                result.attestation = await this.parseOnChainAttestation(attestation, uid);
            }
            logger_1.logger.info('Attestation verification completed', {
                uid,
                valid,
                verificationTime: result.details.verificationTime
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Failed to verify attestation', {
                uid,
                error: error instanceof Error ? error.message : String(error)
            });
            if (error instanceof attestation_1.AttestationError) {
                throw error;
            }
            throw new attestation_1.AttestationVerificationError('Attestation verification failed', uid, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Gas Estimation =====
    async estimateGas(request) {
        try {
            const attestationData = this.transformKycToAttestationData(request.kycResult, request.recipient);
            const encodedData = this.encodeAttestationData(attestationData);
            const attestationRequest = {
                schema: this.config.defaultSchemaId,
                data: {
                    recipient: request.recipient,
                    expirationTime: BigInt(request.options?.expirationTime || this.calculateExpirationTime()),
                    revocable: request.options?.revocable ?? true,
                    data: encodedData,
                },
            };
            // Estimate gas for the transaction (using reasonable default since EAS SDK doesn't expose estimateGas)
            const estimatedGas = BigInt(350000); // Typical gas for EAS attestation
            // Get current gas price
            let gasPrice;
            if (this.config.gasPrice) {
                gasPrice = ethers_1.ethers.parseUnits(this.config.gasPrice, 'gwei');
            }
            else {
                gasPrice = (await this.provider.getFeeData()).gasPrice || ethers_1.ethers.parseUnits('20', 'gwei');
            }
            const gasLimit = Number(estimatedGas) + 50000; // Add buffer
            const totalCost = gasPrice * BigInt(gasLimit);
            return {
                gasLimit,
                gasPrice: ethers_1.ethers.formatUnits(gasPrice, 'gwei') + ' gwei',
                totalCost: ethers_1.ethers.formatEther(totalCost) + ' ETH',
                estimatedConfirmationTime: this.estimateConfirmationTime(gasPrice)
            };
        }
        catch (error) {
            logger_1.logger.error('Gas estimation failed', {
                recipient: request.recipient,
                error: error instanceof Error ? error.message : String(error)
            });
            throw new attestation_1.AttestationError('Gas estimation failed', 'GAS_ESTIMATION_FAILED', { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Revocation =====
    async revokeAttestation(uid, reason) {
        try {
            if (!this.config.enableRevocation) {
                throw new attestation_1.AttestationError('Attestation revocation is disabled', 'REVOCATION_DISABLED');
            }
            logger_1.logger.info('Revoking attestation', { uid, reason });
            const tx = await this.eas.revoke({
                schema: this.config.defaultSchemaId,
                data: { uid, value: 0n }
            });
            const txHash = await tx.wait();
            // Get the actual receipt from provider
            const receipt = await this.provider.getTransactionReceipt(txHash);
            if (!receipt) {
                throw new attestation_1.AttestationError('Revocation receipt not available', 'REVOCATION_FAILED');
            }
            // Log revocation activity
            this.logAttestationActivity('revoked', uid, this.config.attesterAddress, {
                reason,
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });
            // Log status update
            logger_1.logger.info('Attestation status updated', { uid, status: 'revoked', reason });
            logger_1.logger.info('Attestation revoked successfully', {
                uid,
                transactionHash: receipt.hash
            });
            return true;
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke attestation', {
                uid,
                error: error instanceof Error ? error.message : String(error)
            });
            if (error instanceof attestation_1.AttestationError) {
                throw error;
            }
            throw new attestation_1.AttestationError('Attestation revocation failed', 'REVOCATION_FAILED', { uid, error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Helper Methods =====
    encodeAttestationData(data) {
        return this.schemaEncoder.encodeData([
            { name: 'kycProvider', value: data.kycProvider, type: 'string' },
            { name: 'kycSessionId', value: data.kycSessionId, type: 'string' },
            { name: 'verificationStatus', value: data.verificationStatus, type: 'string' },
            { name: 'verificationTimestamp', value: data.verificationTimestamp, type: 'uint256' },
            { name: 'confidenceScore', value: data.confidenceScore, type: 'uint256' },
            { name: 'userIdHash', value: data.userIdHash, type: 'string' },
            { name: 'countryCode', value: data.countryCode || '', type: 'string' },
            { name: 'documentType', value: data.documentType || '', type: 'string' },
            { name: 'documentVerified', value: data.documentVerified, type: 'bool' },
            { name: 'biometricVerified', value: data.biometricVerified, type: 'bool' },
            { name: 'livenessVerified', value: data.livenessVerified, type: 'bool' },
            { name: 'addressVerified', value: data.addressVerified, type: 'bool' },
            { name: 'sanctionsCleared', value: data.sanctionsCleared, type: 'bool' },
            { name: 'pepCleared', value: data.pepCleared, type: 'bool' },
            { name: 'riskLevel', value: data.riskLevel, type: 'string' },
            { name: 'riskScore', value: data.riskScore, type: 'uint256' },
            { name: 'schemaVersion', value: data.schemaVersion, type: 'string' },
            { name: 'apiVersion', value: data.apiVersion, type: 'string' },
            { name: 'attestationStandard', value: data.attestationStandard, type: 'string' }
        ]);
    }
    async extractAttestationUid(receipt) {
        // Parse transaction logs to find the Attested event
        for (const log of receipt.logs) {
            try {
                const iface = new ethers_1.ethers.Interface([
                    'event Attested(address indexed recipient, address indexed attester, bytes32 uid, bytes32 schema)'
                ]);
                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'Attested') {
                    return parsed.args.uid;
                }
            }
            catch {
                // Ignore parsing errors for other events
            }
        }
        throw new attestation_1.AttestationCreationError('Could not extract attestation UID from transaction');
    }
    async parseOnChainAttestation(onChainAttestation, uid) {
        // This would decode the on-chain attestation data back to our format
        // For now, return a placeholder implementation
        const decoded = this.schemaEncoder.decodeData(onChainAttestation.data);
        const attestationData = {
            kycProvider: decoded.find(d => d.name === 'kycProvider')?.value.value,
            kycSessionId: decoded.find(d => d.name === 'kycSessionId')?.value.value,
            verificationStatus: decoded.find(d => d.name === 'verificationStatus')?.value.value,
            verificationTimestamp: Number(decoded.find(d => d.name === 'verificationTimestamp')?.value.value),
            confidenceScore: Number(decoded.find(d => d.name === 'confidenceScore')?.value.value),
            userIdHash: decoded.find(d => d.name === 'userIdHash')?.value.value,
            countryCode: decoded.find(d => d.name === 'countryCode')?.value.value,
            documentType: decoded.find(d => d.name === 'documentType')?.value.value,
            documentVerified: decoded.find(d => d.name === 'documentVerified')?.value.value,
            biometricVerified: decoded.find(d => d.name === 'biometricVerified')?.value.value,
            livenessVerified: decoded.find(d => d.name === 'livenessVerified')?.value.value,
            addressVerified: decoded.find(d => d.name === 'addressVerified')?.value.value,
            sanctionsCleared: decoded.find(d => d.name === 'sanctionsCleared')?.value.value,
            pepCleared: decoded.find(d => d.name === 'pepCleared')?.value.value,
            riskLevel: decoded.find(d => d.name === 'riskLevel')?.value.value,
            riskScore: Number(decoded.find(d => d.name === 'riskScore')?.value.value),
            schemaVersion: decoded.find(d => d.name === 'schemaVersion')?.value.value,
            apiVersion: decoded.find(d => d.name === 'apiVersion')?.value.value,
            attestationStandard: decoded.find(d => d.name === 'attestationStandard')?.value.value
        };
        return {
            id: (0, uuid_1.v4)(), // Would be from database
            uid,
            schemaId: onChainAttestation.schema,
            attester: onChainAttestation.attester,
            recipient: onChainAttestation.recipient,
            data: attestationData,
            encodedData: onChainAttestation.data,
            transactionHash: '', // Would need to query
            blockNumber: 0, // Would need to query
            blockTimestamp: Number(onChainAttestation.time),
            chainId: this.config.chainId,
            status: onChainAttestation.revocationTime > 0 ? 'revoked' : 'confirmed',
            revoked: onChainAttestation.revocationTime > 0,
            ...(onChainAttestation.revocationTime > 0 && { revokedAt: Number(onChainAttestation.revocationTime) }),
            createdAt: new Date(Number(onChainAttestation.time) * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            ...(onChainAttestation.expirationTime > 0 && {
                expiresAt: new Date(Number(onChainAttestation.expirationTime) * 1000).toISOString()
            }),
            metadata: {}
        };
    }
    getVerificationErrors(verification) {
        const errors = [];
        if (!verification.onChain)
            errors.push('Attestation not found on-chain');
        if (!verification.schemaValid)
            errors.push('Invalid schema');
        if (!verification.notRevoked)
            errors.push('Attestation has been revoked');
        if (!verification.notExpired)
            errors.push('Attestation has expired');
        if (!verification.attesterValid)
            errors.push('Invalid attester');
        if (!verification.recipientMatch)
            errors.push('Recipient mismatch');
        return errors;
    }
    estimateConfirmationTime(gasPrice) {
        // Rough estimation based on gas price
        const gasPriceGwei = Number(ethers_1.ethers.formatUnits(gasPrice, 'gwei'));
        if (gasPriceGwei > 50)
            return 30; // Fast
        if (gasPriceGwei > 20)
            return 60; // Standard
        return 180; // Slow
    }
    // ===== Database Operations (Placeholder) =====
    async storeAttestation(attestation) {
        try {
            // Store in database first
            await this.storeAttestationInDb(attestation);
            // If Arweave storage is configured, store there as well
            if (this.arweaveService) {
                const arweaveData = await this.arweaveService.uploadData({
                    data: Buffer.from(JSON.stringify(attestation)),
                    contentType: 'application/json',
                    tags: [
                        { name: 'OneKey-Type', value: 'attestation' },
                        { name: 'OneKey-Attestation-UID', value: attestation.uid },
                        { name: 'OneKey-Schema-ID', value: attestation.schemaId },
                        { name: 'OneKey-Recipient', value: attestation.recipient }
                    ],
                    metadata: {
                        uploadedBy: attestation.attester,
                        uploadTimestamp: attestation.createdAt,
                        dataHash: crypto_1.default.createHash('sha256').update(JSON.stringify(attestation)).digest('hex'),
                        category: 'attestation_metadata',
                        description: `Attestation ${attestation.uid} for ${attestation.recipient}`
                    },
                    permanent: true
                });
                // Update attestation with Arweave transaction ID
                const updatedMetadata = {
                    gasUsed: attestation.metadata.gasUsed,
                    gasPrice: attestation.metadata.gasPrice,
                    requestId: attestation.metadata.requestId,
                    batchIndex: attestation.metadata.batchIndex,
                    arweaveTransactionId: arweaveData.transactionId
                };
                attestation.metadata = updatedMetadata;
                await this.updateAttestationInDb(attestation);
                logger_1.logger.info('Attestation stored in Arweave', {
                    uid: attestation.uid,
                    transactionId: arweaveData.transactionId
                });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to store attestation', {
                uid: attestation.uid,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async storeAttestationInDb(attestation) {
        // TODO: Implement database storage
        logger_1.logger.info('Storing attestation in database', { uid: attestation.uid });
    }
    async updateAttestationInDb(attestation) {
        // TODO: Implement database update
        logger_1.logger.info('Updating attestation in database', { uid: attestation.uid });
    }
    async validateRequest(request) {
        if (!request.recipient || !ethers_1.ethers.isAddress(request.recipient)) {
            throw new attestation_1.AttestationError('Invalid recipient address', 'INVALID_RECIPIENT', { recipient: request.recipient });
        }
        if (!request.kycResult) {
            throw new attestation_1.AttestationError('KYC result is required', 'MISSING_KYC_RESULT');
        }
        // Additional validation as needed
    }
}
exports.EasService = EasService;
//# sourceMappingURL=easService.js.map
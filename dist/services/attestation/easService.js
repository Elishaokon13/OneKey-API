"use strict";
// OneKey KYC API - EAS Service Implementation
// Ethereum Attestation Service integration for KYC verification proofs
Object.defineProperty(exports, "__esModule", { value: true });
exports.EasService = void 0;
const ethers_1 = require("ethers");
const eas_sdk_1 = require("@ethereum-attestation-service/eas-sdk");
const uuid_1 = require("uuid");
const baseAttestationService_1 = require("./baseAttestationService");
const attestation_1 = require("../../types/attestation");
const logger_1 = require("../../utils/logger");
class EasService extends baseAttestationService_1.BaseAttestationService {
    eas;
    schemaEncoder;
    SCHEMA_DEFINITION = 'string kycProvider,string kycSessionId,string verificationStatus,uint256 verificationTimestamp,uint256 confidenceScore,string userIdHash,string countryCode,string documentType,bool documentVerified,bool biometricVerified,bool livenessVerified,bool addressVerified,bool sanctionsCleared,bool pepCleared,string riskLevel,uint256 riskScore,string schemaVersion,string apiVersion,string attestationStandard';
    constructor(easConfig) {
        super(easConfig);
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
            // Create the attestation on-chain
            const tx = await this.eas.attest(attestationRequest);
            const receipt = await tx.wait();
            if (!receipt) {
                throw new attestation_1.AttestationCreationError('Transaction receipt not available');
            }
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
            // Store attestation in database (placeholder - would be implemented)
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
                notRevoked: !attestation.revoked,
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
                errors: valid ? undefined : this.getVerificationErrors(verification)
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
            // Estimate gas for the transaction
            const estimatedGas = await this.eas.attest.estimateGas(attestationRequest);
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
            const receipt = await tx.wait();
            if (!receipt) {
                throw new attestation_1.AttestationError('Revocation transaction failed', 'REVOCATION_FAILED');
            }
            // Log revocation activity
            this.logAttestationActivity('revoked', uid, this.config.attesterAddress, {
                reason,
                transactionHash: receipt.hash,
                gasUsed: receipt.gasUsed.toString()
            });
            // Update attestation in database (placeholder)
            await this.updateAttestationStatus(uid, 'revoked', reason);
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
            status: onChainAttestation.revoked ? 'revoked' : 'confirmed',
            revoked: onChainAttestation.revoked,
            revokedAt: onChainAttestation.revoked ? Number(onChainAttestation.revocationTime) : undefined,
            createdAt: new Date(Number(onChainAttestation.time) * 1000).toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: onChainAttestation.expirationTime > 0
                ? new Date(Number(onChainAttestation.expirationTime) * 1000).toISOString()
                : undefined,
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
        // TODO: Implement database storage
        logger_1.logger.info('Storing attestation in database', { uid: attestation.uid });
    }
    async updateAttestationStatus(uid, status, reason) {
        // TODO: Implement database update
        logger_1.logger.info('Updating attestation status', { uid, status, reason });
    }
}
exports.EasService = EasService;
//# sourceMappingURL=easService.js.map
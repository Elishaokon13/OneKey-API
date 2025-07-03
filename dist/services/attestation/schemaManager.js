"use strict";
// OneKey KYC API - EAS Schema Manager
// Handles schema registration, versioning, and validation for EAS attestations
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchemaManager = void 0;
const ethers_1 = require("ethers");
const eas_sdk_1 = require("@ethereum-attestation-service/eas-sdk");
const logger_1 = require("../../utils/logger");
const attestation_1 = require("../../types/attestation");
class SchemaManager {
    schemaRegistry;
    provider;
    signer;
    config;
    schemaCache = new Map();
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        try {
            // Check required configuration
            if (!this.config.rpcUrl ||
                !this.config.privateKey ||
                !this.config.registryAddress) {
                throw new attestation_1.SchemaError('Missing required configuration: rpcUrl, privateKey, or registryAddress');
            }
            // Initialize provider and signer
            this.provider = new ethers_1.ethers.JsonRpcProvider(this.config.rpcUrl);
            this.signer = new ethers_1.ethers.Wallet(this.config.privateKey, this.provider);
            // Initialize schema registry
            this.schemaRegistry = new eas_sdk_1.SchemaRegistry(this.config.registryAddress);
            this.schemaRegistry.connect(this.signer);
            logger_1.logger.info('Schema manager initialized', {
                registryAddress: this.config.registryAddress,
                signer: await this.signer.getAddress(),
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to initialize schema manager', { error });
            throw new attestation_1.SchemaError('Schema manager initialization failed', undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async registerSchema(name, description, schema, version, revocable = true) {
        try {
            // Validate schema before registration
            this.validateSchemaString(schema);
            // Add version and metadata to schema
            const schemaWithMetadata = this.addSchemaMetadata(schema, name, description, version);
            if (!this.schemaRegistry) {
                throw new attestation_1.SchemaError('Schema registry not initialized');
            }
            const tx = await this.schemaRegistry.register({
                schema: schemaWithMetadata,
                resolverAddress: this.config.defaultResolver || ethers_1.ethers.ZeroAddress,
                revocable,
            });
            // Fix: Handle the case where tx.wait() returns a string (likely the schema ID)
            const result = await tx.wait();
            let schemaId;
            if (typeof result === 'string') {
                // If result is already the schema ID
                schemaId = result;
            }
            else if (result && typeof result === 'object') {
                // If result is a transaction receipt
                const receipt = result;
                schemaId = this.extractSchemaIdFromLogs(receipt.logs);
            }
            else {
                throw new attestation_1.SchemaError('Invalid transaction result');
            }
            logger_1.logger.info('Schema registered successfully', {
                schemaId,
                name,
                version: `${version.major}.${version.minor}.${version.patch}`,
                revocable,
            });
            return schemaId;
        }
        catch (error) {
            logger_1.logger.error('Failed to register schema', { error });
            throw new attestation_1.SchemaError('Schema registration failed', undefined, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async getSchema(schemaId) {
        try {
            // Check cache first
            if (this.config.caching?.enabled) {
                const cached = this.schemaCache.get(schemaId);
                if (cached &&
                    Date.now() - cached.timestamp < (this.config.caching.ttl * 1000)) {
                    return cached.schema;
                }
            }
            if (!this.schemaRegistry) {
                throw new attestation_1.SchemaError('Schema registry not initialized');
            }
            // Get schema from registry
            const params = { uid: schemaId };
            const schema = await this.schemaRegistry.getSchema(params);
            if (!schema) {
                throw new attestation_1.SchemaError('Schema not found', schemaId);
            }
            // Parse schema and extract metadata
            const attestationSchema = this.parseSchema({
                uid: schema.uid,
                schema: schema.schema,
                resolver: schema.resolver,
                revocable: schema.revocable,
                registerer: '',
                transactionHash: '',
            });
            // Update cache
            if (this.config.caching?.enabled) {
                this.schemaCache.set(schemaId, {
                    schema: attestationSchema,
                    timestamp: Date.now(),
                });
            }
            return attestationSchema;
        }
        catch (error) {
            logger_1.logger.error('Failed to get schema', { schemaId, error });
            throw new attestation_1.SchemaError('Schema retrieval failed', schemaId, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async validateSchema(schemaId) {
        try {
            // Get schema from registry
            const schema = await this.getSchema(schemaId);
            // Validate schema structure and fields
            const validation = this.validateSchemaStructure(schema);
            return {
                valid: validation.valid,
                schema,
                version: this.extractSchemaVersion(schema),
                errors: validation.errors,
                warnings: validation.warnings,
            };
        }
        catch (error) {
            logger_1.logger.error('Schema validation failed', { schemaId, error });
            throw new attestation_1.SchemaError('Schema validation failed', schemaId, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    async checkCompatibility(sourceSchemaId, targetSchemaId) {
        try {
            const sourceSchema = await this.getSchema(sourceSchemaId);
            const targetSchema = await this.getSchema(targetSchemaId);
            return this.compareSchemas(sourceSchema, targetSchema);
        }
        catch (error) {
            logger_1.logger.error('Schema compatibility check failed', {
                sourceSchemaId,
                targetSchemaId,
                error,
            });
            throw new attestation_1.SchemaError('Schema compatibility check failed', sourceSchemaId, { error: error instanceof Error ? error.message : String(error) });
        }
    }
    // ===== Private Helper Methods =====
    validateSchemaString(schema) {
        // Validate schema string format and field types
        const fieldRegex = /^[a-zA-Z_][a-zA-Z0-9_]* [a-zA-Z][a-zA-Z0-9]*$/;
        const fields = schema.split(',').map((f) => f.trim());
        const errors = [];
        for (const field of fields) {
            if (!fieldRegex.test(field)) {
                errors.push(`Invalid field format: ${field}`);
            }
        }
        if (errors.length > 0) {
            throw new attestation_1.SchemaError('Invalid schema format', undefined, { errors });
        }
    }
    addSchemaMetadata(schema, name, description, version) {
        // Add metadata as a comment at the start of the schema
        const metadata = {
            name,
            description,
            version: `${version.major}.${version.minor}.${version.patch}`,
            createdAt: new Date().toISOString(),
        };
        return `/* ${JSON.stringify(metadata)} */\n${schema}`;
    }
    extractSchemaIdFromLogs(logs) {
        for (const log of logs) {
            try {
                const iface = new ethers_1.ethers.Interface([
                    'event Registered(bytes32 indexed uid, address indexed registerer, string schema)',
                ]);
                const parsed = iface.parseLog(log);
                if (parsed?.name === 'Registered') {
                    return parsed.args.uid;
                }
            }
            catch {
                // Skip logs that don't match the event
                continue;
            }
        }
        throw new attestation_1.SchemaError('Could not extract schema ID from transaction');
    }
    validateSchemaStructure(schema) {
        const errors = [];
        const warnings = [];
        // Check required fields
        if (!schema.name)
            errors.push('Schema name is required');
        if (!schema.version)
            errors.push('Schema version is required');
        if (!schema.schema)
            errors.push('Schema definition is required');
        // Validate field types
        for (const field of schema.fields) {
            if (!this.isValidFieldType(field.type)) {
                errors.push(`Invalid field type: ${field.type} for field ${field.name}`);
            }
            if (!field.name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                errors.push(`Invalid field name format: ${field.name}`);
            }
        }
        // Check for duplicate field names
        const fieldNames = schema.fields.map((f) => f.name);
        const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
        if (duplicates.length > 0) {
            errors.push(`Duplicate field names: ${duplicates.join(', ')}`);
        }
        // Add warnings for best practices
        if (!schema.description) {
            warnings.push('Schema description is recommended');
        }
        if (schema.fields.some((f) => !f.description)) {
            warnings.push('Field descriptions are recommended for all fields');
        }
        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }
    isValidFieldType(type) {
        const validTypes = [
            'uint256',
            'int256',
            'bool',
            'string',
            'bytes',
            'address',
            'bytes32',
        ];
        return validTypes.includes(type);
    }
    parseSchema(rawSchema) {
        // Extract metadata from schema comment if present
        const metadataMatch = rawSchema.schema.match(/\/\* (.*?) \*\//);
        let metadata = {};
        if (metadataMatch) {
            try {
                metadata = JSON.parse(metadataMatch[1] ?? '{}');
            }
            catch {
                // Invalid metadata JSON, ignore
            }
        }
        // Parse schema string into fields
        const schemaFields = rawSchema.schema
            .replace(/\/\*.*?\*\//s, '') // Remove metadata comment
            .trim()
            .split(',')
            .map((field) => {
            const [type, name] = field.trim().split(' ');
            return {
                name,
                type,
                description: '', // Would be in metadata
                required: true, // All fields are required by default
            };
        });
        return {
            id: rawSchema.uid,
            name: metadata.name ?? 'Unknown Schema',
            description: metadata.description ?? '',
            version: metadata.version ?? '1.0.0',
            schema: rawSchema.schema,
            resolver: rawSchema.resolver,
            revocable: rawSchema.revocable,
            fields: schemaFields,
            createdAt: metadata.createdAt ?? new Date().toISOString(),
            creator: rawSchema.registerer ?? 'unknown',
            registrationTransaction: rawSchema.transactionHash ?? '',
        };
    }
    compareSchemas(source, target) {
        const sourceFields = new Map(source.fields.map((f) => [f.name, f]));
        const targetFields = new Map(target.fields.map((f) => [f.name, f]));
        const added = [];
        const removed = [];
        const modified = [];
        let breaking = false;
        // Find added and modified fields
        for (const [name, field] of targetFields) {
            const sourceField = sourceFields.get(name);
            if (!sourceField) {
                added.push(name);
                if (field.required)
                    breaking = true;
            }
            else if (field.type !== sourceField.type) {
                modified.push(name);
                breaking = true;
            }
        }
        // Find removed fields
        for (const [name, field] of sourceFields) {
            if (!targetFields.has(name)) {
                removed.push(name);
                if (field.required)
                    breaking = true;
            }
        }
        return {
            compatible: !breaking,
            changes: { added, removed, modified },
            breaking,
        };
    }
    extractSchemaVersion(schema) {
        const versionStr = schema.version;
        const [major = 1, minor = 0, patch = 0] = versionStr
            .split('.')
            .map(Number);
        return { major, minor, patch };
    }
}
exports.SchemaManager = SchemaManager;
//# sourceMappingURL=schemaManager.js.map
// OneKey KYC API - EAS Schema Manager
// Handles schema registration, versioning, and validation for EAS attestations

import { ethers } from 'ethers';
import { SchemaRegistry, GetSchemaParams } from '@ethereum-attestation-service/eas-sdk';
import { logger } from '../../utils/logger';
import { 
  SchemaConfig, 
  SchemaVersion,
  SchemaValidationResult,
  SchemaError,
  AttestationSchema,
  SchemaCompatibility,
  AttestationSchemaField
} from '../../types/attestation';

interface SchemaMetadata {
  name: string;
  description: string;
  version: string;
  createdAt: string;
}

export class SchemaManager {
  private schemaRegistry!: SchemaRegistry;
  private provider!: ethers.JsonRpcProvider;
  private signer!: ethers.Wallet;
  private readonly config: SchemaConfig;
  private schemaCache: Map<string, { schema: AttestationSchema; timestamp: number }> = new Map();

  constructor(config: SchemaConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize provider and signer
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
      this.signer = new ethers.Wallet(this.config.privateKey, this.provider);

      // Initialize schema registry
      this.schemaRegistry = new SchemaRegistry(this.config.registryAddress);
      this.schemaRegistry.connect(this.signer);

      logger.info('Schema manager initialized', {
        registryAddress: this.config.registryAddress,
        signer: await this.signer.getAddress()
      });
    } catch (error) {
      logger.error('Failed to initialize schema manager', { error });
      throw new SchemaError(
        'Schema manager initialization failed',
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async registerSchema(
    name: string,
    description: string,
    schema: string,
    version: SchemaVersion,
    revocable: boolean = true
  ): Promise<string> {
    try {
      // Validate schema before registration
      this.validateSchemaString(schema);

      // Add version and metadata to schema
      const schemaWithMetadata = this.addSchemaMetadata(schema, name, description, version);

      const tx = await this.schemaRegistry.register({
        schema: schemaWithMetadata,
        resolverAddress: this.config.defaultResolver,
        revocable
      });

      const receipt = await tx.wait() as ethers.ContractTransactionReceipt;
      if (!receipt) {
        throw new SchemaError('Transaction receipt not available');
      }
      
      // Extract schema ID from transaction logs
      const schemaId = await this.extractSchemaId(receipt);
      
      logger.info('Schema registered successfully', {
        schemaId,
        name,
        version: `${version.major}.${version.minor}.${version.patch}`,
        revocable
      });

      return schemaId;
    } catch (error) {
      logger.error('Failed to register schema', { error });
      throw new SchemaError(
        'Schema registration failed',
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getSchema(schemaId: string): Promise<AttestationSchema> {
    try {
      // Check cache first
      if (this.config.caching?.enabled) {
        const cached = this.schemaCache.get(schemaId);
        if (cached && Date.now() - cached.timestamp < (this.config.caching.ttl * 1000)) {
          return cached.schema;
        }
      }

      // Get schema from registry
      const params: GetSchemaParams = { uid: schemaId };
      const schema = await this.schemaRegistry.getSchema(params);
      
      if (!schema) {
        throw new SchemaError('Schema not found', schemaId);
      }

      // Parse schema and extract metadata
      const attestationSchema = this.parseSchema(schema);

      // Update cache
      if (this.config.caching?.enabled) {
        this.schemaCache.set(schemaId, {
          schema: attestationSchema,
          timestamp: Date.now()
        });
      }

      return attestationSchema;
    } catch (error) {
      logger.error('Failed to get schema', { schemaId, error });
      throw new SchemaError(
        'Schema retrieval failed',
        schemaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async validateSchema(schemaId: string): Promise<SchemaValidationResult> {
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
        warnings: validation.warnings
      };
    } catch (error) {
      logger.error('Schema validation failed', { schemaId, error });
      throw new SchemaError(
        'Schema validation failed',
        schemaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async checkCompatibility(
    sourceSchemaId: string,
    targetSchemaId: string
  ): Promise<SchemaCompatibility> {
    try {
      const sourceSchema = await this.getSchema(sourceSchemaId);
      const targetSchema = await this.getSchema(targetSchemaId);

      return this.compareSchemas(sourceSchema, targetSchema);
    } catch (error) {
      logger.error('Schema compatibility check failed', {
        sourceSchemaId,
        targetSchemaId,
        error
      });
      throw new SchemaError(
        'Schema compatibility check failed',
        sourceSchemaId,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  // ===== Private Helper Methods =====

  private validateSchemaString(schema: string): void {
    // Validate schema string format and field types
    const fieldRegex = /^[a-zA-Z_][a-zA-Z0-9_]* [a-zA-Z][a-zA-Z0-9]*$/;
    const fields = schema.split(',').map(f => f.trim());
    
    const errors: string[] = [];
    for (const field of fields) {
      if (!fieldRegex.test(field)) {
        errors.push(`Invalid field format: ${field}`);
      }
    }

    if (errors.length > 0) {
      throw new SchemaError('Invalid schema format', undefined, { errors });
    }
  }

  private addSchemaMetadata(
    schema: string,
    name: string,
    description: string,
    version: SchemaVersion
  ): string {
    // Add metadata as a comment at the start of the schema
    const metadata: SchemaMetadata = {
      name,
      description,
      version: `${version.major}.${version.minor}.${version.patch}`,
      createdAt: new Date().toISOString()
    };

    return `/* ${JSON.stringify(metadata)} */\n${schema}`;
  }

  private async extractSchemaId(receipt: ethers.ContractTransactionReceipt | null): Promise<string> {
    if (!receipt) {
      throw new SchemaError('Transaction receipt is null');
    }
    
    for (const log of receipt.logs) {
      try {
        const iface = new ethers.Interface([
          'event Registered(bytes32 indexed uid, address indexed registerer, string schema)'
        ]);
        const parsed = iface.parseLog(log);
        if (parsed && parsed.name === 'Registered') {
          return parsed.args.uid;
        }
      } catch {
        // Skip logs that don't match the event
        continue;
      }
    }
    throw new SchemaError('Could not extract schema ID from transaction');
  }

  private validateSchemaStructure(schema: AttestationSchema): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!schema.name) errors.push('Schema name is required');
    if (!schema.version) errors.push('Schema version is required');
    if (!schema.schema) errors.push('Schema definition is required');

    // Validate field types
    for (const field of schema.fields as AttestationSchemaField[]) {
      if (!this.isValidFieldType(field.type)) {
        errors.push(`Invalid field type: ${field.type} for field ${field.name}`);
      }
      if (!field.name.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        errors.push(`Invalid field name format: ${field.name}`);
      }
    }

    // Check for duplicate field names
    const fieldNames = schema.fields.map(f => f.name);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate field names: ${duplicates.join(', ')}`);
    }

    // Add warnings for best practices
    if (!schema.description) {
      warnings.push('Schema description is recommended');
    }
    if (schema.fields.some(f => !f.description)) {
      warnings.push('Field descriptions are recommended for all fields');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private isValidFieldType(type: string): boolean {
    const validTypes = [
      'uint256', 'int256', 'bool', 'string', 'bytes', 'address', 'bytes32'
    ];
    return validTypes.includes(type);
  }

  private parseSchema(rawSchema: any): AttestationSchema {
    // Extract metadata from schema comment if present
    const metadataMatch = rawSchema.schema.match(/\/\* (.*?) \*\//);
    let metadata: Partial<SchemaMetadata> = {};
    if (metadataMatch) {
      try {
        metadata = JSON.parse(metadataMatch[1]) as SchemaMetadata;
      } catch {
        // Invalid metadata JSON, ignore
      }
    }

    // Parse schema string into fields
    const schemaFields = rawSchema.schema
      .replace(/\/\*.*?\*\//s, '') // Remove metadata comment
      .trim()
      .split(',')
      .map(field => {
        const [type, name] = field.trim().split(' ');
        return {
          name,
          type,
          description: '', // Would be in metadata
          required: true // All fields are required by default
        } as AttestationSchemaField;
      });

    return {
      id: rawSchema.uid,
      name: metadata.name || 'Unknown Schema',
      description: metadata.description || '',
      version: metadata.version || '1.0.0',
      schema: rawSchema.schema,
      resolver: rawSchema.resolver,
      revocable: rawSchema.revocable,
      fields: schemaFields,
      createdAt: metadata.createdAt || new Date().toISOString(),
      creator: rawSchema.registerer,
      registrationTransaction: rawSchema.transactionHash
    };
  }

  private compareSchemas(
    source: AttestationSchema,
    target: AttestationSchema
  ): SchemaCompatibility {
    const sourceFields = new Map(source.fields.map(f => [f.name, f]));
    const targetFields = new Map(target.fields.map(f => [f.name, f]));

    const added: string[] = [];
    const removed: string[] = [];
    const modified: string[] = [];
    let breaking = false;

    // Find added and modified fields
    for (const [name, field] of targetFields) {
      const sourceField = sourceFields.get(name);
      if (!sourceField) {
        added.push(name);
        if (field.required) breaking = true;
      } else if (field.type !== sourceField.type) {
        modified.push(name);
        breaking = true;
      }
    }

    // Find removed fields
    for (const [name, field] of sourceFields) {
      if (!targetFields.has(name)) {
        removed.push(name);
        if (field.required) breaking = true;
      }
    }

    return {
      compatible: !breaking,
      changes: { added, removed, modified },
      breaking
    };
  }

  private extractSchemaVersion(schema: AttestationSchema): SchemaVersion {
    const versionStr = schema.version;
    const [major = 1, minor = 0, patch = 0] = versionStr.split('.').map(Number);
    return { major, minor, patch };
  }
}
 
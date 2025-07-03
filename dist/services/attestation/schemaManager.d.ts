import { SchemaConfig, SchemaVersion, SchemaValidationResult, AttestationSchema, SchemaCompatibility } from '../../types/attestation';
export declare class SchemaManager {
    private schemaRegistry;
    private provider;
    private signer;
    private readonly config;
    private readonly schemaCache;
    constructor(config: SchemaConfig);
    initialize(): Promise<void>;
    registerSchema(name: string, description: string, schema: string, version: SchemaVersion, revocable?: boolean): Promise<string>;
    getSchema(schemaId: string): Promise<AttestationSchema>;
    validateSchema(schemaId: string): Promise<SchemaValidationResult>;
    checkCompatibility(sourceSchemaId: string, targetSchemaId: string): Promise<SchemaCompatibility>;
    private validateSchemaString;
    private addSchemaMetadata;
    private extractSchemaIdFromLogs;
    private validateSchemaStructure;
    private isValidFieldType;
    private parseSchema;
    private compareSchemas;
    private extractSchemaVersion;
}
//# sourceMappingURL=schemaManager.d.ts.map
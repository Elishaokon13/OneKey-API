// OneKey KYC API - Access Control Types

/**
 * Role-based Access Control Types
 */
export enum Role {
  ADMIN = 'admin',
  MANAGER = 'manager',
  OPERATOR = 'operator',
  VIEWER = 'viewer'
}

export enum Permission {
  // Project Management
  CREATE_PROJECT = 'create:project',
  READ_PROJECT = 'read:project',
  UPDATE_PROJECT = 'update:project',
  DELETE_PROJECT = 'delete:project',
  
  // KYC Operations
  CREATE_KYC = 'create:kyc',
  READ_KYC = 'read:kyc',
  UPDATE_KYC = 'update:kyc',
  DELETE_KYC = 'delete:kyc',
  
  // Encryption Operations
  ENCRYPT_DATA = 'encrypt:data',
  DECRYPT_DATA = 'decrypt:data',
  MANAGE_KEYS = 'manage:keys',
  
  // Analytics
  VIEW_ANALYTICS = 'view:analytics',
  EXPORT_ANALYTICS = 'export:analytics'
}

export interface RoleDefinition {
  name: Role;
  permissions: Permission[];
  description: string;
}

/**
 * Attribute-based Access Control Types
 */
export enum AttributeType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  ARRAY = 'array'
}

export interface AttributeDefinition {
  name: string;
  type: AttributeType;
  required: boolean;
  description: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    enum?: string[];
  };
}

export interface SubjectAttributes {
  roles: Role[];
  organization: string;
  projectId: string;
  environment: string;
  ipAddress?: string;
  deviceId?: string;
  lastAuthenticated?: Date;
  customAttributes?: Record<string, any>;
}

export interface ResourceAttributes {
  type: string;
  id: string;
  owner: string;
  projectId: string;
  organization: string;
  environment: string;
  tags?: string[];
  sensitivity?: string;
  customAttributes?: Record<string, any>;
}

export interface EnvironmentAttributes {
  timestamp: Date;
  timeOfDay: number;
  dayOfWeek: number;
  ipRange?: string;
  location?: string;
  customAttributes?: Record<string, any>;
}

/**
 * Policy Types
 */
export enum Effect {
  ALLOW = 'allow',
  DENY = 'deny'
}

export enum ConditionOperator {
  // Comparison
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  GREATER_THAN_EQUALS = 'greater_than_equals',
  LESS_THAN_EQUALS = 'less_than_equals',
  
  // String
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  MATCHES = 'matches',
  
  // Array
  IN = 'in',
  NOT_IN = 'not_in',
  
  // Logical
  AND = 'and',
  OR = 'or',
  NOT = 'not'
}

export interface Condition {
  operator: ConditionOperator;
  attribute: string;
  value: any;
  negate?: boolean;
}

export interface PolicyStatement {
  effect: Effect;
  actions: Permission[];
  resources: string[];
  conditions?: Condition[];
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  version: string;
  statements: PolicyStatement[];
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
  };
}

/**
 * Access Request Types
 */
export interface AccessRequest {
  subject: SubjectAttributes;
  resource: ResourceAttributes;
  action: Permission;
  environment: EnvironmentAttributes;
  context?: Record<string, any>;
}

export interface AccessResponse {
  allowed: boolean;
  reason?: string;
  conditions?: Condition[];
  expiresAt?: Date;
  auditLog?: {
    requestId: string;
    timestamp: Date;
    decision: Effect;
    matchedPolicies: string[];
  };
}

/**
 * Lit Protocol Integration Types
 */
export interface LitAccessControlCondition {
  contractAddress: string;
  standardContractType: string;
  chain: string;
  method: string;
  parameters: string[];
  returnValueTest: {
    comparator: string;
    value: string;
  };
}

export interface PolicyToLitConditionConverter {
  convertPolicy(policy: Policy): LitAccessControlCondition[];
  convertStatement(statement: PolicyStatement): LitAccessControlCondition[];
  convertCondition(condition: Condition): LitAccessControlCondition;
} 
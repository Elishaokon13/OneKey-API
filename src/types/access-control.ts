export type Permission = string; // Format: "resource:action" e.g. "api:read"

export interface Role {
  description: string;
  permissions: Permission[];
  parent?: string; // Parent role name for inheritance
}

export interface RBACConfig {
  enabled: boolean;
  roles: Record<string, Role>;
}

export interface ABACRule {
  name: string;
  description: string;
  conditions: {
    environment?: string;
    requiredRoles?: string[];
    [key: string]: any; // Additional attributes
  };
}

export interface ABACConfig {
  enabled: boolean;
  rules: ABACRule[];
}

// Project Settings Types
export interface ProjectSettings {
  id: string;
  project_id: string;
  key: string;
  value: RBACConfig | ABACConfig | any;
  created_at: Date;
  updated_at: Date;
}

// User Types
export interface UserMetadata {
  roles?: string[]; // Role names assigned to user
  attributes?: Record<string, any>; // ABAC attributes
  preferences?: Record<string, any>;
}

export interface User {
  id: string;
  email: string;
  password_hash?: string;
  wallet_address?: string;
  passkey_id?: string;
  project_id?: string;
  created_at: Date;
  updated_at: Date;
  last_login?: Date;
  is_active: boolean;
  metadata: UserMetadata;
}

// Organization Types
export interface OrganizationMetadata {
  roles?: Record<string, Role>;
  settings?: Record<string, any>;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  billing_email: string;
  status: string;
  subscription_tier: string;
  subscription_status: string;
  subscription_expires_at?: Date;
  created_at: Date;
  updated_at: Date;
  metadata: OrganizationMetadata;
}

// Project Types
export interface ProjectMetadata {
  settings?: Record<string, any>;
  features?: string[];
}

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  environment: string;
  status: string;
  kyc_providers: any[];
  webhook_url?: string;
  webhook_secret?: string;
  created_at: Date;
  updated_at: Date;
  metadata: ProjectMetadata;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  project_id?: string;
  user_id?: string;
  action: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}

// Project Usage Stats Types
export interface ProjectUsageStats {
  id: string;
  project_id: string;
  period_start: Date;
  period_end: Date;
  api_calls: number;
  storage_used: number;
  bandwidth_used: number;
  created_at: Date;
  updated_at: Date;
} 
import { z } from 'zod';

// Enum definitions
export enum ProjectStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted'
}

export enum ProjectType {
  Production = 'production',
  Sandbox = 'sandbox'
}

export enum ApiKeyStatus {
  Active = 'active',
  Revoked = 'revoked',
  Expired = 'expired'
}

export enum ApiKeyType {
  Secret = 'secret',
  Public = 'public'
}

export enum MemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member'
}

export enum MemberStatus {
  Invited = 'invited',
  Active = 'active',
  Removed = 'removed'
}

export enum OrganizationStatus {
  Active = 'active',
  Suspended = 'suspended',
  Deleted = 'deleted'
}

export enum SubscriptionTier {
  Free = 'free',
  Pro = 'pro',
  Enterprise = 'enterprise'
}

export enum SubscriptionStatus {
  Active = 'active',
  PastDue = 'past_due',
  Canceled = 'canceled',
  Expired = 'expired'
}

export enum ProjectEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production'
}

// Interface definitions
export interface Organization {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  status: OrganizationStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: MemberRole;
  status: MemberStatus;
  invitedBy?: string;
  invitedAt: Date;
  joinedAt?: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
  type: ProjectType;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ProjectSettings {
  projectId: string;
  webhookUrl?: string;
  allowedOrigins?: string[];
  customSettings?: Record<string, any>;
  updatedAt: Date;
}

export interface ProjectApiKey {
  id: string;
  projectId: string;
  name: string;
  type: ApiKeyType;
  status: ApiKeyStatus;
  permissions: string[];
  hashedKey: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, any>;
}

export interface ProjectUsageStats {
  projectId: string;
  period: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  avgResponseTime: number;
  updatedAt: Date;
}

// Zod schemas for validation
export const organizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  billingEmail: z.string().email(),
  status: z.nativeEnum(OrganizationStatus),
  subscriptionTier: z.nativeEnum(SubscriptionTier),
  metadata: z.record(z.any()).optional()
});

export const projectSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  environment: z.nativeEnum(ProjectEnvironment),
  status: z.nativeEnum(ProjectStatus),
  kycProviders: z.array(z.string()),
  webhookUrl: z.string().url().optional(),
  webhookSecret: z.string().min(32).optional(),
  metadata: z.record(z.any()).optional()
});

export const projectSettingsSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.any()
});

export const projectApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  type: z.nativeEnum(ApiKeyType),
  permissions: z.array(z.string()),
  expiresAt: z.date().optional(),
  rateLimitOverride: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional()
}); 
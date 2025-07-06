import { z } from 'zod';

// Enum definitions
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

export enum MemberRole {
  Owner = 'owner',
  Admin = 'admin',
  Member = 'member'
}

export enum MemberStatus {
  Active = 'active',
  Invited = 'invited',
  Removed = 'removed'
}

export enum ProjectEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production'
}

export enum ProjectStatus {
  Active = 'active',
  Archived = 'archived',
  Deleted = 'deleted'
}

export enum ApiKeyType {
  Server = 'server',
  Client = 'client',
  Admin = 'admin'
}

// Interface definitions
export interface Organization {
  id: string;
  name: string;
  slug: string;
  billingEmail: string;
  status: OrganizationStatus;
  subscriptionTier: SubscriptionTier;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  environment: ProjectEnvironment;
  status: ProjectStatus;
  kycProviders: string[];
  webhookUrl?: string;
  webhookSecret?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface ProjectSettings {
  id: string;
  projectId: string;
  key: string;
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectApiKey {
  id: string;
  projectId: string;
  keyHash: string;
  name: string;
  type: ApiKeyType;
  permissions: string[];
  createdBy?: string;
  isActive: boolean;
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  usageCount: number;
  rateLimitOverride?: Record<string, any>;
  metadata: Record<string, any>;
}

export interface ProjectUsageStats {
  id: string;
  projectId: string;
  date: Date;
  kycVerificationsCount: number;
  attestationsCreatedCount: number;
  storageBytesUsed: number;
  apiRequestsCount: number;
  createdAt: Date;
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
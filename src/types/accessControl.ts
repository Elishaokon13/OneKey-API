export enum AccessLevel {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin'
}

export enum ProjectType {
  WEB2 = 'web2',
  WEB3 = 'web3'
}

export type Permission = 'api:read' | 'api:write' | 'api:admin';

export interface AccessControlPolicy {
  userId: string;
  projectId: string;
  accessLevel: AccessLevel;
  projectType: ProjectType;
}

export interface AccessControlRequest {
  userId: string;
  projectId: string;
  permission: Permission;
}

export interface AccessControlResponse {
  allowed: boolean;
  reason?: string;
} 
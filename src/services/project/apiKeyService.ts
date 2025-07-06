import { Pool } from 'pg';
import { ProjectApiKey, ApiKeyType } from '../../types/project';
import { DatabaseError, NotFoundError } from '../../utils/errors';
import crypto from 'crypto';

export class ApiKeyService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new API key
   */
  async createApiKey(
    projectId: string,
    name: string,
    type: ApiKeyType,
    permissions: string[],
    createdBy: string,
    expiresAt?: Date,
    rateLimitOverride?: Record<string, any>
  ): Promise<{ apiKey: string; apiKeyDetails: ProjectApiKey }> {
    // Generate API key
    const apiKey = this.generateApiKey();
    const keyHash = this.hashApiKey(apiKey);

    const result = await this.pool.query(
      `INSERT INTO project_api_keys 
       (project_id, key_hash, name, type, permissions, created_by, expires_at, rate_limit_override)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        projectId,
        keyHash,
        name,
        type,
        JSON.stringify(permissions),
        createdBy,
        expiresAt,
        rateLimitOverride ? JSON.stringify(rateLimitOverride) : null
      ]
    );

    return {
      apiKey,
      apiKeyDetails: this.mapApiKeyFromDb(result.rows[0])
    };
  }

  /**
   * Get API key by ID
   */
  async getApiKey(id: string): Promise<ProjectApiKey> {
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyFromDb(result.rows[0]);
  }

  /**
   * Get API key by hash
   */
  async getApiKeyByHash(keyHash: string): Promise<ProjectApiKey> {
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE key_hash = $1',
      [keyHash]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyFromDb(result.rows[0]);
  }

  /**
   * Get project API keys
   */
  async getProjectApiKeys(projectId: string): Promise<ProjectApiKey[]> {
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE project_id = $1',
      [projectId]
    );

    return result.rows.map(row => this.mapApiKeyFromDb(row));
  }

  /**
   * Update API key
   */
  async updateApiKey(
    id: string,
    updates: {
      name?: string;
      permissions?: string[];
      isActive?: boolean;
      expiresAt?: Date;
      rateLimitOverride?: Record<string, any>;
      metadata?: Record<string, any>;
    }
  ): Promise<ProjectApiKey> {
    const allowedUpdates = ['name', 'permissions', 'isActive', 'expiresAt', 'rateLimitOverride', 'metadata'];
    const updateFields = Object.keys(updates).filter(key => 
      allowedUpdates.includes(key) && updates[key] !== undefined
    );

    if (updateFields.length === 0) {
      return this.getApiKey(id);
    }

    const setClause = updateFields
      .map((field, index) => `${this.toSnakeCase(field)} = $${index + 2}`)
      .join(', ');
    const values = updateFields.map(field => {
      if (field === 'permissions' || field === 'rateLimitOverride' || field === 'metadata') {
        return JSON.stringify(updates[field]);
      }
      return updates[field];
    });

    const result = await this.pool.query(
      `UPDATE project_api_keys 
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyFromDb(result.rows[0]);
  }

  /**
   * Delete API key
   */
  async deleteApiKey(id: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM project_api_keys WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('API key not found');
    }
  }

  /**
   * Record API key usage
   */
  async recordApiKeyUsage(keyHash: string): Promise<void> {
    await this.pool.query(
      `UPDATE project_api_keys 
       SET usage_count = usage_count + 1,
           last_used_at = NOW()
       WHERE key_hash = $1`,
      [keyHash]
    );
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey: string): Promise<ProjectApiKey> {
    const keyHash = this.hashApiKey(apiKey);
    const result = await this.pool.query(
      `SELECT * FROM project_api_keys 
       WHERE key_hash = $1 
       AND is_active = true 
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [keyHash]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Invalid or expired API key');
    }

    await this.recordApiKeyUsage(keyHash);
    return this.mapApiKeyFromDb(result.rows[0]);
  }

  /**
   * Generate API key
   */
  private generateApiKey(): string {
    const prefix = 'ok';
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64url');
    return `${prefix}_${key}`;
  }

  /**
   * Hash API key
   */
  private hashApiKey(apiKey: string): string {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  // Helper methods for mapping database rows to TypeScript types
  private mapApiKeyFromDb(row: any): ProjectApiKey {
    return {
      id: row.id,
      projectId: row.project_id,
      keyHash: row.key_hash,
      name: row.name,
      type: row.type,
      permissions: row.permissions,
      createdBy: row.created_by,
      isActive: row.is_active,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      usageCount: row.usage_count,
      rateLimitOverride: row.rate_limit_override,
      metadata: row.metadata
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
} 
import { Pool } from 'pg';
import { randomBytes, createHash } from 'crypto';
import { ProjectApiKey, ApiKeyStatus, ApiKeyType } from '../../types/project';
import { DatabaseError, NotFoundError } from '../../utils/errors';

export class ApiKeyService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || new Pool();
  }

  async createApiKey(
    projectId: string,
    name: string,
    type: ApiKeyType = ApiKeyType.Secret,
    permissions: string[] = [],
    createdBy: string,
    expiresAt?: Date,
    metadata?: Record<string, any>
  ): Promise<{ apiKey: string; apiKeyDetails: ProjectApiKey }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const apiKey = this.generateApiKey(type);
      const hashedKey = this.hashApiKey(apiKey);

      const result = await client.query(
        `INSERT INTO project_api_keys (
          project_id, name, type, hashed_key, permissions,
          created_by, expires_at, metadata, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *`,
        [
          projectId,
          name,
          type,
          hashedKey,
          permissions,
          createdBy,
          expiresAt,
          metadata || {},
          ApiKeyStatus.Active
        ]
      );

      await client.query('COMMIT');

      return {
        apiKey,
        apiKeyDetails: this.mapApiKeyRow(result.rows[0])
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create API key');
    } finally {
      client.release();
    }
  }

  async getApiKey(id: string): Promise<ProjectApiKey> {
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyRow(result.rows[0]);
  }

  async getProjectApiKeys(projectId: string): Promise<ProjectApiKey[]> {
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE project_id = $1',
      [projectId]
    );

    return result.rows.map(row => this.mapApiKeyRow(row));
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const hashedKey = this.hashApiKey(apiKey);
    const result = await this.pool.query(
      'SELECT * FROM project_api_keys WHERE hashed_key = $1 AND status = $2',
      [hashedKey, ApiKeyStatus.Active]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const key = result.rows[0];
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      await this.updateApiKeyStatus(key.id, ApiKeyStatus.Expired);
      return false;
    }

    await this.updateApiKeyLastUsed(key.id);
    return true;
  }

  async revokeApiKey(id: string): Promise<ProjectApiKey> {
    const result = await this.pool.query(
      `UPDATE project_api_keys
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [ApiKeyStatus.Revoked, id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyRow(result.rows[0]);
  }

  async updateApiKeyLastUsed(id: string): Promise<ProjectApiKey> {
    const result = await this.pool.query(
      `UPDATE project_api_keys
       SET last_used_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('API key not found');
    }

    return this.mapApiKeyRow(result.rows[0]);
  }

  private async updateApiKeyStatus(
    id: string,
    status: ApiKeyStatus
  ): Promise<void> {
    await this.pool.query(
      `UPDATE project_api_keys
       SET status = $1, updated_at = NOW()
       WHERE id = $2`,
      [status, id]
    );
  }

  private generateApiKey(type: ApiKeyType): string {
    const prefix = type === ApiKeyType.Secret ? 'sk' : 'pk';
    const randomString = randomBytes(32).toString('base64url');
    return `${prefix}_${randomString}`;
  }

  private hashApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private mapApiKeyRow(row: any): ProjectApiKey {
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      type: row.type,
      status: row.status,
      permissions: row.permissions || [],
      hashedKey: row.hashed_key,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      metadata: row.metadata || {}
    };
  }
} 
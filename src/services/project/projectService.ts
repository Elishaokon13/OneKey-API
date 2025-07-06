import { Pool } from 'pg';
import { Project, ProjectSettings, ProjectEnvironment, ProjectStatus } from '../../types/project';
import { generateSlug } from '../../utils/slugGenerator';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';
import crypto from 'crypto';

export class ProjectService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new project
   */
  async createProject(
    organizationId: string,
    name: string,
    environment: ProjectEnvironment,
    kycProviders: string[] = []
  ): Promise<Project> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Generate slug from name
      const slug = await generateSlug(name);

      // Generate webhook secret
      const webhookSecret = crypto.randomBytes(32).toString('hex');

      // Create project
      const result = await client.query(
        `INSERT INTO projects 
         (organization_id, name, slug, environment, status, kyc_providers, webhook_secret)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          organizationId,
          name,
          slug,
          environment,
          ProjectStatus.Active,
          JSON.stringify(kycProviders),
          webhookSecret
        ]
      );

      // Initialize default settings
      await this.initializeDefaultSettings(client, result.rows[0].id);

      await client.query('COMMIT');

      return this.mapProjectFromDb(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create project', error);
    } finally {
      client.release();
    }
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project> {
    const result = await this.pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    return this.mapProjectFromDb(result.rows[0]);
  }

  /**
   * Get projects by organization ID
   */
  async getOrganizationProjects(organizationId: string): Promise<Project[]> {
    const result = await this.pool.query(
      'SELECT * FROM projects WHERE organization_id = $1',
      [organizationId]
    );

    return result.rows.map(row => this.mapProjectFromDb(row));
  }

  /**
   * Update project details
   */
  async updateProject(
    id: string,
    updates: Partial<Project>
  ): Promise<Project> {
    const allowedUpdates = ['name', 'status', 'kycProviders', 'webhookUrl', 'metadata'];
    const updateFields = Object.keys(updates).filter(key => 
      allowedUpdates.includes(key) && updates[key] !== undefined
    );

    if (updateFields.length === 0) {
      throw new ValidationError('No valid update fields provided');
    }

    const setClause = updateFields
      .map((field, index) => `${this.toSnakeCase(field)} = $${index + 2}`)
      .join(', ');
    const values = updateFields.map(field => {
      if (field === 'kycProviders') {
        return JSON.stringify(updates[field]);
      }
      return updates[field];
    });

    const result = await this.pool.query(
      `UPDATE projects 
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    return this.mapProjectFromDb(result.rows[0]);
  }

  /**
   * Archive project
   */
  async archiveProject(id: string): Promise<Project> {
    const result = await this.pool.query(
      `UPDATE projects 
       SET status = $2
       WHERE id = $1
       RETURNING *`,
      [id, ProjectStatus.Archived]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    return this.mapProjectFromDb(result.rows[0]);
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM projects WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Project not found');
    }
  }

  /**
   * Get project settings
   */
  async getProjectSettings(projectId: string): Promise<ProjectSettings[]> {
    const result = await this.pool.query(
      'SELECT * FROM project_settings WHERE project_id = $1',
      [projectId]
    );

    return result.rows.map(row => this.mapSettingsFromDb(row));
  }

  /**
   * Get specific project setting
   */
  async getProjectSetting(projectId: string, key: string): Promise<ProjectSettings> {
    const result = await this.pool.query(
      'SELECT * FROM project_settings WHERE project_id = $1 AND key = $2',
      [projectId, key]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project setting not found');
    }

    return this.mapSettingsFromDb(result.rows[0]);
  }

  /**
   * Update project setting
   */
  async updateProjectSetting(
    projectId: string,
    key: string,
    value: any
  ): Promise<ProjectSettings> {
    const result = await this.pool.query(
      `INSERT INTO project_settings (project_id, key, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, key)
       DO UPDATE SET value = $3
       RETURNING *`,
      [projectId, key, value]
    );

    return this.mapSettingsFromDb(result.rows[0]);
  }

  /**
   * Delete project setting
   */
  async deleteProjectSetting(projectId: string, key: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM project_settings WHERE project_id = $1 AND key = $2',
      [projectId, key]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Project setting not found');
    }
  }

  /**
   * Initialize default project settings
   */
  private async initializeDefaultSettings(client: any, projectId: string): Promise<void> {
    const defaultSettings = {
      'kyc.verification.retries': 3,
      'kyc.verification.timeout': 300,
      'kyc.providers.priority': ['smile_identity', 'onfido', 'trulioo'],
      'storage.encryption.enabled': true,
      'storage.retention.days': 30,
      'webhook.retries': 3,
      'webhook.timeout': 10,
      'rate_limit.requests_per_minute': 60,
      'rate_limit.burst': 10
    };

    for (const [key, value] of Object.entries(defaultSettings)) {
      await client.query(
        `INSERT INTO project_settings (project_id, key, value)
         VALUES ($1, $2, $3)`,
        [projectId, key, value]
      );
    }
  }

  // Helper methods for mapping database rows to TypeScript types
  private mapProjectFromDb(row: any): Project {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      slug: row.slug,
      environment: row.environment,
      status: row.status,
      kycProviders: row.kyc_providers,
      webhookUrl: row.webhook_url,
      webhookSecret: row.webhook_secret,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata
    };
  }

  private mapSettingsFromDb(row: any): ProjectSettings {
    return {
      id: row.id,
      projectId: row.project_id,
      key: row.key,
      value: row.value,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
} 
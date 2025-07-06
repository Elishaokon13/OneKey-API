import { Pool } from 'pg';
import { Project, ProjectType, ProjectStatus, ProjectSettings } from '../../types/project';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';
import { generateSlug } from '../../utils/slugGenerator';

export class ProjectService {
  private pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || new Pool();
  }

  async createProject(
    name: string,
    organizationId: string,
    type: ProjectType,
    metadata?: Record<string, any>
  ): Promise<Project> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const slug = await generateSlug(name);
      const result = await client.query(
        `INSERT INTO projects (name, slug, organization_id, type, status, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, slug, organizationId, type, ProjectStatus.Active, metadata || {}]
      );

      await client.query('COMMIT');
      return this.mapProjectRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create project');
    } finally {
      client.release();
    }
  }

  async getProject(id: string): Promise<Project> {
    const result = await this.pool.query(
      'SELECT * FROM projects WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    return this.mapProjectRow(result.rows[0]);
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const allowedUpdates = ['name', 'metadata', 'status'] as const;
    type AllowedUpdate = typeof allowedUpdates[number];

    const updateFields = Object.keys(updates).filter((key): key is AllowedUpdate =>
      allowedUpdates.includes(key as AllowedUpdate) && updates[key as keyof Project] !== undefined
    );

    if (updateFields.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    const setClause = updateFields
      .map((field, index) => `${this.toSnakeCase(field)} = $${index + 2}`)
      .join(', ');

    const values = updateFields.map(field => updates[field as keyof Project]);

    const result = await this.pool.query(
      `UPDATE projects
       SET ${setClause}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project not found');
    }

    return this.mapProjectRow(result.rows[0]);
  }

  async getProjectsByOrganization(organizationId: string): Promise<Project[]> {
    const result = await this.pool.query(
      'SELECT * FROM projects WHERE organization_id = $1',
      [organizationId]
    );

    return result.rows.map(row => this.mapProjectRow(row));
  }

  async updateProjectSettings(
    projectId: string,
    settings: Partial<ProjectSettings>
  ): Promise<ProjectSettings> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // First check if project exists
      const projectExists = await client.query(
        'SELECT id FROM projects WHERE id = $1',
        [projectId]
      );

      if (projectExists.rows.length === 0) {
        throw new NotFoundError('Project not found');
      }

      const result = await client.query(
        `INSERT INTO project_settings (project_id, webhook_url, allowed_origins, custom_settings)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (project_id)
         DO UPDATE SET
           webhook_url = COALESCE(EXCLUDED.webhook_url, project_settings.webhook_url),
           allowed_origins = COALESCE(EXCLUDED.allowed_origins, project_settings.allowed_origins),
           custom_settings = COALESCE(EXCLUDED.custom_settings, project_settings.custom_settings),
           updated_at = NOW()
         RETURNING *`,
        [
          projectId,
          settings.webhookUrl,
          settings.allowedOrigins || [],
          settings.customSettings || {}
        ]
      );

      await client.query('COMMIT');
      return this.mapSettingsRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof NotFoundError) {
        throw error;
      }
      if (error instanceof Error) {
        throw new DatabaseError(`Failed to update project settings: ${error.message}`);
      }
      throw new DatabaseError('Failed to update project settings');
    } finally {
      client.release();
    }
  }

  async getProjectSettings(projectId: string): Promise<ProjectSettings> {
    const result = await this.pool.query(
      'SELECT * FROM project_settings WHERE project_id = $1',
      [projectId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Project settings not found');
    }

    return this.mapSettingsRow(result.rows[0]);
  }

  private mapProjectRow(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      organizationId: row.organization_id,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata || {}
    };
  }

  private mapSettingsRow(row: any): ProjectSettings {
    return {
      projectId: row.project_id,
      webhookUrl: row.webhook_url,
      allowedOrigins: row.allowed_origins || [],
      customSettings: row.custom_settings || {},
      updatedAt: row.updated_at
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
} 
import { Pool } from 'pg';
import { Organization, OrganizationMember, OrganizationStatus, MemberRole, MemberStatus } from '../../types/project';
import { generateSlug } from '../../utils/slugGenerator';
import { DatabaseError, NotFoundError, ValidationError } from '../../utils/errors';

export class OrganizationService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Create a new organization
   */
  async createOrganization(
    name: string,
    billingEmail: string,
    createdByUserId: string
  ): Promise<Organization> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Generate slug from name
      const slug = await generateSlug(name);

      // Create organization
      const orgResult = await client.query(
        `INSERT INTO organizations (
          name, 
          slug, 
          billing_email, 
          status, 
          subscription_tier, 
          subscription_status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [
          name, 
          slug, 
          billingEmail, 
          OrganizationStatus.Active,
          'free', // Default subscription tier
          'active' // Default subscription status
        ]
      );

      // Add creator as owner
      await client.query(
        `INSERT INTO organization_members (organization_id, user_id, role, status, joined_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [orgResult.rows[0].id, createdByUserId, MemberRole.Owner, MemberStatus.Active]
      );

      await client.query('COMMIT');

      return this.mapOrganizationFromDb(orgResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new DatabaseError('Failed to create organization');
    } finally {
      client.release();
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(id: string): Promise<Organization> {
    const result = await this.pool.query(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organization not found');
    }

    return this.mapOrganizationFromDb(result.rows[0]);
  }

  /**
   * Update organization details
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>
  ): Promise<Organization> {
    const allowedUpdates = [
      'name', 
      'billingEmail', 
      'status', 
      'metadata',
      'subscriptionTier',
      'subscriptionStatus',
      'subscriptionExpiresAt'
    ] as const;
    type AllowedUpdate = typeof allowedUpdates[number];

    const updateFields = Object.keys(updates).filter((key): key is AllowedUpdate =>
      allowedUpdates.includes(key as AllowedUpdate) && updates[key as keyof Organization] !== undefined
    );

    if (updateFields.length === 0) {
      throw new ValidationError('No valid update fields provided');
    }

    const setClause = updateFields
      .map((field, index) => `${this.toSnakeCase(field)} = $${index + 2}`)
      .join(', ');
    const values = updateFields.map(field => updates[field as keyof Organization]);

    const result = await this.pool.query(
      `UPDATE organizations 
       SET ${setClause}
       WHERE id = $1
       RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organization not found');
    }

    return this.mapOrganizationFromDb(result.rows[0]);
  }

  /**
   * Delete organization
   */
  async deleteOrganization(id: string): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM organizations WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Organization not found');
    }
  }

  /**
   * Add member to organization
   */
  async addMember(
    organizationId: string,
    userId: string,
    role: MemberRole,
    invitedByUserId: string
  ): Promise<OrganizationMember> {
    const result = await this.pool.query(
      `INSERT INTO organization_members 
       (organization_id, user_id, role, status, invited_by, invited_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [organizationId, userId, role, MemberStatus.Invited, invitedByUserId]
    );

    return this.mapMemberFromDb(result.rows[0]);
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    newRole: MemberRole
  ): Promise<OrganizationMember> {
    const result = await this.pool.query(
      `UPDATE organization_members
       SET role = $3
       WHERE organization_id = $1 AND user_id = $2
       RETURNING *`,
      [organizationId, userId, newRole]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organization member not found');
    }

    return this.mapMemberFromDb(result.rows[0]);
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `DELETE FROM organization_members
       WHERE organization_id = $1 AND user_id = $2`,
      [organizationId, userId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Organization member not found');
    }
  }

  /**
   * Get organization members
   */
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const result = await this.pool.query(
      `SELECT * FROM organization_members
       WHERE organization_id = $1`,
      [organizationId]
    );

    return result.rows.map(row => this.mapMemberFromDb(row));
  }

  /**
   * Accept organization invitation
   */
  async acceptInvitation(organizationId: string, userId: string): Promise<OrganizationMember> {
    const result = await this.pool.query(
      `UPDATE organization_members
       SET status = $3, joined_at = NOW()
       WHERE organization_id = $1 AND user_id = $2 AND status = $4
       RETURNING *`,
      [organizationId, userId, MemberStatus.Active, MemberStatus.Invited]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Organization invitation not found or already accepted');
    }

    return this.mapMemberFromDb(result.rows[0]);
  }

  // Helper methods for mapping database rows to TypeScript types
  private mapOrganizationFromDb(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      billingEmail: row.billing_email,
      status: row.status,
      subscriptionTier: row.subscription_tier,
      subscriptionStatus: row.subscription_status,
      subscriptionExpiresAt: row.subscription_expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      metadata: row.metadata
    };
  }

  private mapMemberFromDb(row: any): OrganizationMember {
    return {
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      role: row.role,
      status: row.status,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
} 
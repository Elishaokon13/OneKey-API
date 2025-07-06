// OneKey KYC API - Policy Engine Service

import { Pool } from 'pg';
import {
  Policy,
  PolicyStatement,
  Effect,
  AccessRequest,
  AccessResponse,
  Condition,
  ConditionOperator
} from '@/types/accessControl';
import { RBACService } from './rbacService';
import { ABACService } from './abacService';
import { logger } from '@/utils/logger';

export class PolicyEngine {
  private readonly pool: Pool;
  private readonly rbacService: RBACService;
  private readonly abacService: ABACService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.rbacService = new RBACService(pool);
    this.abacService = new ABACService();
  }

  /**
   * Create a new policy
   */
  public async createPolicy(policy: Policy, createdBy: string): Promise<Policy> {
    try {
      const result = await this.pool.query(
        `INSERT INTO policies (
          id, name, description, version, statements, metadata,
          created_by, created_at, updated_by, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $7, NOW())
        RETURNING *`,
        [
          policy.id,
          policy.name,
          policy.description,
          policy.version,
          JSON.stringify(policy.statements),
          JSON.stringify(policy.metadata || {}),
          createdBy
        ]
      );

      logger.info('Policy created successfully', { policyId: policy.id });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to create policy', { error, policy });
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  public async updatePolicy(
    policyId: string,
    updates: Partial<Policy>,
    updatedBy: string
  ): Promise<Policy> {
    try {
      const result = await this.pool.query(
        `UPDATE policies
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             version = COALESCE($3, version),
             statements = COALESCE($4, statements),
             metadata = COALESCE($5, metadata),
             updated_by = $6,
             updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [
          updates.name,
          updates.description,
          updates.version,
          updates.statements ? JSON.stringify(updates.statements) : null,
          updates.metadata ? JSON.stringify(updates.metadata) : null,
          updatedBy,
          policyId
        ]
      );

      if (result.rowCount === 0) {
        throw new Error(`Policy ${policyId} not found`);
      }

      logger.info('Policy updated successfully', { policyId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to update policy', { error, policyId, updates });
      throw error;
    }
  }

  /**
   * Delete a policy
   */
  public async deletePolicy(policyId: string, deletedBy: string): Promise<void> {
    try {
      const result = await this.pool.query(
        `UPDATE policies
         SET active = false,
             deleted_by = $1,
             deleted_at = NOW()
         WHERE id = $2 AND active = true`,
        [deletedBy, policyId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Policy ${policyId} not found or already deleted`);
      }

      logger.info('Policy deleted successfully', { policyId });
    } catch (error) {
      logger.error('Failed to delete policy', { error, policyId });
      throw error;
    }
  }

  /**
   * Get a policy by ID
   */
  public async getPolicy(policyId: string): Promise<Policy> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM policies WHERE id = $1 AND active = true`,
        [policyId]
      );

      if (result.rowCount === 0) {
        throw new Error(`Policy ${policyId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Failed to get policy', { error, policyId });
      throw error;
    }
  }

  /**
   * List policies with optional filters
   */
  public async listPolicies(filters: {
    name?: string;
    version?: string;
    createdBy?: string;
  }): Promise<Policy[]> {
    try {
      let query = 'SELECT * FROM policies WHERE active = true';
      const params: any[] = [];

      if (filters.name) {
        params.push(filters.name);
        query += ` AND name = $${params.length}`;
      }

      if (filters.version) {
        params.push(filters.version);
        query += ` AND version = $${params.length}`;
      }

      if (filters.createdBy) {
        params.push(filters.createdBy);
        query += ` AND created_by = $${params.length}`;
      }

      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Failed to list policies', { error, filters });
      throw error;
    }
  }

  /**
   * Evaluate a policy statement
   */
  private async evaluatePolicyStatement(
    statement: PolicyStatement,
    request: AccessRequest
  ): Promise<boolean> {
    try {
      // Check if the action is allowed by the statement
      if (!statement.actions.includes(request.action)) {
        return false;
      }

      // Check if the resource is covered by the statement
      const resourceMatch = statement.resources.some(resource => {
        // Support wildcard matching
        const pattern = resource.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(request.resource.id);
      });

      if (!resourceMatch) {
        return false;
      }

      // If there are no conditions, the statement matches
      if (!statement.conditions || statement.conditions.length === 0) {
        return true;
      }

      // Evaluate all conditions
      const conditionResults = await Promise.all(
        statement.conditions.map(condition =>
          this.evaluateCondition(condition, request)
        )
      );

      // All conditions must be met for the statement to match
      return conditionResults.every(result => result);
    } catch (error) {
      logger.error('Failed to evaluate policy statement', {
        error,
        statement,
        request
      });
      throw error;
    }
  }

  /**
   * Evaluate a condition
   */
  private async evaluateCondition(
    condition: Condition,
    request: AccessRequest
  ): Promise<boolean> {
    try {
      // Combine all attributes for evaluation
      const attributes = {
        ...request.subject,
        ...request.resource,
        ...request.environment,
        ...request.context
      };

      // Special handling for logical operators
      if (condition.operator === ConditionOperator.AND) {
        const subConditions = condition.value as Condition[];
        const results = await Promise.all(
          subConditions.map(cond => this.evaluateCondition(cond, request))
        );
        return results.every(result => result);
      }

      if (condition.operator === ConditionOperator.OR) {
        const subConditions = condition.value as Condition[];
        const results = await Promise.all(
          subConditions.map(cond => this.evaluateCondition(cond, request))
        );
        return results.some(result => result);
      }

      if (condition.operator === ConditionOperator.NOT) {
        const subCondition = condition.value as Condition;
        const result = await this.evaluateCondition(subCondition, request);
        return !result;
      }

      // For all other operators, delegate to ABAC service
      return this.abacService.evaluateCondition(condition, attributes);
    } catch (error) {
      logger.error('Failed to evaluate condition', { error, condition, request });
      throw error;
    }
  }

  /**
   * Check access based on policies
   */
  public async checkAccess(request: AccessRequest): Promise<AccessResponse> {
    try {
      // First, check RBAC
      const rbacResponse = await this.rbacService.checkAccess(request);
      if (!rbacResponse.allowed) {
        return rbacResponse;
      }

      // Then, check ABAC
      const abacResponse = await this.abacService.checkAccess(request);
      if (!abacResponse.allowed) {
        return abacResponse;
      }

      // Finally, check policies
      const policies = await this.listPolicies({});
      const matchedPolicies: string[] = [];
      let finalEffect: Effect = Effect.DENY; // Default deny

      for (const policy of policies) {
        for (const statement of policy.statements) {
          const matches = await this.evaluatePolicyStatement(statement, request);
          if (matches) {
            matchedPolicies.push(policy.id);
            if (statement.effect === Effect.ALLOW) {
              finalEffect = Effect.ALLOW;
            } else {
              // Explicit deny takes precedence
              finalEffect = Effect.DENY;
              break;
            }
          }
        }

        if (finalEffect === Effect.DENY && matchedPolicies.length > 0) {
          // If we hit an explicit deny, stop processing
          break;
        }
      }

      return {
        allowed: finalEffect === Effect.ALLOW,
        reason: finalEffect === Effect.ALLOW
          ? 'Access allowed by policies'
          : 'Access denied by policies',
        auditLog: {
          requestId: crypto.randomUUID(),
          timestamp: new Date(),
          decision: finalEffect,
          matchedPolicies
        }
      };
    } catch (error) {
      logger.error('Failed to check access', { error, request });
      throw error;
    }
  }
} 
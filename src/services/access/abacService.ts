// OneKey KYC API - Attribute-based Access Control Service

import {
  AttributeDefinition,
  AttributeType,
  SubjectAttributes,
  ResourceAttributes,
  EnvironmentAttributes,
  Condition,
  ConditionOperator,
  AccessRequest,
  AccessResponse,
  Effect
} from '@/types/accessControl';
import { logger } from '@/utils/logger';

export class ABACService {
  private attributeDefinitions: Map<string, AttributeDefinition>;

  constructor() {
    this.attributeDefinitions = new Map();
    this.initializeAttributeDefinitions();
  }

  /**
   * Initialize default attribute definitions
   */
  private initializeAttributeDefinitions(): void {
    // Subject attributes
    this.attributeDefinitions.set('subject.roles', {
      name: 'roles',
      type: AttributeType.ARRAY,
      required: true,
      description: 'User roles'
    });

    this.attributeDefinitions.set('subject.organization', {
      name: 'organization',
      type: AttributeType.STRING,
      required: true,
      description: 'Organization ID'
    });

    this.attributeDefinitions.set('subject.environment', {
      name: 'environment',
      type: AttributeType.STRING,
      required: true,
      description: 'Environment (production, staging, etc.)',
      validation: {
        enum: ['production', 'staging', 'development']
      }
    });

    // Resource attributes
    this.attributeDefinitions.set('resource.type', {
      name: 'type',
      type: AttributeType.STRING,
      required: true,
      description: 'Resource type'
    });

    this.attributeDefinitions.set('resource.sensitivity', {
      name: 'sensitivity',
      type: AttributeType.STRING,
      required: false,
      description: 'Data sensitivity level',
      validation: {
        enum: ['public', 'internal', 'confidential', 'restricted']
      }
    });

    // Environment attributes
    this.attributeDefinitions.set('environment.timeOfDay', {
      name: 'timeOfDay',
      type: AttributeType.NUMBER,
      required: true,
      description: 'Hour of day (0-23)',
      validation: {
        min: 0,
        max: 23
      }
    });

    this.attributeDefinitions.set('environment.dayOfWeek', {
      name: 'dayOfWeek',
      type: AttributeType.NUMBER,
      required: true,
      description: 'Day of week (0-6)',
      validation: {
        min: 0,
        max: 6
      }
    });
  }

  /**
   * Validate attributes against definitions
   */
  private validateAttributes(
    attributes: Record<string, any>,
    prefix: string
  ): boolean {
    for (const [key, definition] of this.attributeDefinitions) {
      if (!key.startsWith(prefix)) continue;

      const attributeName = key.split('.')[1];
      const value = attributes[attributeName];

      if (definition.required && value === undefined) {
        throw new Error(`Required attribute ${key} is missing`);
      }

      if (value !== undefined) {
        if (!this.validateAttributeValue(value, definition)) {
          throw new Error(`Invalid value for attribute ${key}`);
        }
      }
    }

    return true;
  }

  /**
   * Validate attribute value against definition
   */
  private validateAttributeValue(value: any, definition: AttributeDefinition): boolean {
    switch (definition.type) {
      case AttributeType.STRING:
        if (typeof value !== 'string') return false;
        if (definition.validation?.pattern && !new RegExp(definition.validation.pattern).test(value)) {
          return false;
        }
        if (definition.validation?.enum && !definition.validation.enum.includes(value)) {
          return false;
        }
        break;

      case AttributeType.NUMBER:
        if (typeof value !== 'number') return false;
        if (definition.validation?.min !== undefined && value < definition.validation.min) {
          return false;
        }
        if (definition.validation?.max !== undefined && value > definition.validation.max) {
          return false;
        }
        break;

      case AttributeType.BOOLEAN:
        if (typeof value !== 'boolean') return false;
        break;

      case AttributeType.DATE:
        if (!(value instanceof Date)) return false;
        break;

      case AttributeType.ARRAY:
        if (!Array.isArray(value)) return false;
        break;
    }

    return true;
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: Condition, attributes: Record<string, any>): boolean {
    const value = attributes[condition.attribute];
    if (value === undefined) return false;

    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return value === condition.value;

      case ConditionOperator.NOT_EQUALS:
        return value !== condition.value;

      case ConditionOperator.GREATER_THAN:
        return value > condition.value;

      case ConditionOperator.LESS_THAN:
        return value < condition.value;

      case ConditionOperator.GREATER_THAN_EQUALS:
        return value >= condition.value;

      case ConditionOperator.LESS_THAN_EQUALS:
        return value <= condition.value;

      case ConditionOperator.STARTS_WITH:
        return typeof value === 'string' && value.startsWith(condition.value);

      case ConditionOperator.ENDS_WITH:
        return typeof value === 'string' && value.endsWith(condition.value);

      case ConditionOperator.CONTAINS:
        return typeof value === 'string' && value.includes(condition.value);

      case ConditionOperator.NOT_CONTAINS:
        return typeof value === 'string' && !value.includes(condition.value);

      case ConditionOperator.MATCHES:
        return typeof value === 'string' && new RegExp(condition.value).test(value);

      case ConditionOperator.IN:
        return Array.isArray(condition.value) && condition.value.includes(value);

      case ConditionOperator.NOT_IN:
        return Array.isArray(condition.value) && !condition.value.includes(value);

      default:
        return false;
    }
  }

  /**
   * Check access based on ABAC
   */
  public async checkAccess(request: AccessRequest): Promise<AccessResponse> {
    try {
      // Validate attributes
      this.validateAttributes(request.subject, 'subject');
      this.validateAttributes(request.resource, 'resource');
      this.validateAttributes(request.environment, 'environment');

      // Example conditions for demonstration
      const conditions: Condition[] = [
        // Check if user is in the same organization as the resource
        {
          operator: ConditionOperator.EQUALS,
          attribute: 'organization',
          value: request.resource.organization
        },
        // Check if user is in the same environment as the resource
        {
          operator: ConditionOperator.EQUALS,
          attribute: 'environment',
          value: request.resource.environment
        },
        // Check if access is during business hours (9 AM - 5 PM)
        {
          operator: ConditionOperator.GREATER_THAN_EQUALS,
          attribute: 'timeOfDay',
          value: 9
        },
        {
          operator: ConditionOperator.LESS_THAN_EQUALS,
          attribute: 'timeOfDay',
          value: 17
        },
        // Check if access is during weekdays
        {
          operator: ConditionOperator.LESS_THAN,
          attribute: 'dayOfWeek',
          value: 5
        }
      ];

      // Evaluate all conditions
      const conditionResults = conditions.map(condition => 
        this.evaluateCondition(condition, {
          ...request.subject,
          ...request.environment
        })
      );

      // All conditions must be met
      const allowed = conditionResults.every(result => result);

      return {
        allowed,
        reason: allowed ? 'All conditions met' : 'One or more conditions not met',
        conditions,
        auditLog: {
          requestId: crypto.randomUUID(),
          timestamp: new Date(),
          decision: allowed ? Effect.ALLOW : Effect.DENY,
          matchedPolicies: ['abac:default']
        }
      };
    } catch (error) {
      logger.error('Failed to check ABAC access', { error, request });
      throw error;
    }
  }

  /**
   * Get attribute definition
   */
  public getAttributeDefinition(key: string): AttributeDefinition | undefined {
    return this.attributeDefinitions.get(key);
  }

  /**
   * Add custom attribute definition
   */
  public addAttributeDefinition(key: string, definition: AttributeDefinition): void {
    this.attributeDefinitions.set(key, definition);
  }

  /**
   * Remove attribute definition
   */
  public removeAttributeDefinition(key: string): boolean {
    return this.attributeDefinitions.delete(key);
  }
}
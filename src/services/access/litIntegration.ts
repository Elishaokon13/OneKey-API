// OneKey KYC API - Lit Protocol Integration Service

import {
  Policy,
  PolicyStatement,
  Condition,
  ConditionOperator,
  LitAccessControlCondition,
  PolicyToLitConditionConverter
} from '@/types/accessControl';
import { logger } from '@/utils/logger';

export class LitIntegrationService implements PolicyToLitConditionConverter {
  private readonly defaultChain: string = 'ethereum';

  /**
   * Convert a policy to Lit Protocol conditions
   */
  public convertPolicy(policy: Policy): LitAccessControlCondition[] {
    try {
      const conditions: LitAccessControlCondition[] = [];

      for (const statement of policy.statements) {
        conditions.push(...this.convertStatement(statement));
      }

      return conditions;
    } catch (error) {
      logger.error('Failed to convert policy to Lit conditions', {
        error,
        policy
      });
      throw error;
    }
  }

  /**
   * Convert a policy statement to Lit Protocol conditions
   */
  public convertStatement(statement: PolicyStatement): LitAccessControlCondition[] {
    try {
      const conditions: LitAccessControlCondition[] = [];

      // Convert resource patterns to conditions
      for (const resource of statement.resources) {
        conditions.push(this.convertResourcePattern(resource));
      }

      // Convert statement conditions
      if (statement.conditions) {
        for (const condition of statement.conditions) {
          conditions.push(this.convertCondition(condition));
        }
      }

      return conditions;
    } catch (error) {
      logger.error('Failed to convert statement to Lit conditions', {
        error,
        statement
      });
      throw error;
    }
  }

  /**
   * Convert a resource pattern to a Lit Protocol condition
   */
  private convertResourcePattern(pattern: string): LitAccessControlCondition {
    // Convert resource pattern to a regex condition
    return {
      contractAddress: '',
      standardContractType: 'raw-regex',
      chain: this.defaultChain,
      method: 'regex',
      parameters: [pattern.replace('*', '.*')],
      returnValueTest: {
        comparator: 'contains',
        value: 'true'
      }
    };
  }

  /**
   * Convert a condition to a Lit Protocol condition
   */
  public convertCondition(condition: Condition): LitAccessControlCondition {
    try {
      switch (condition.operator) {
        case ConditionOperator.EQUALS:
          return {
            contractAddress: '',
            standardContractType: 'raw-value',
            chain: this.defaultChain,
            method: 'equals',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.NOT_EQUALS:
          return {
            contractAddress: '',
            standardContractType: 'raw-value',
            chain: this.defaultChain,
            method: 'equals',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'false'
            }
          };

        case ConditionOperator.GREATER_THAN:
          return {
            contractAddress: '',
            standardContractType: 'raw-value',
            chain: this.defaultChain,
            method: 'greaterThan',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.LESS_THAN:
          return {
            contractAddress: '',
            standardContractType: 'raw-value',
            chain: this.defaultChain,
            method: 'lessThan',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.IN:
          return {
            contractAddress: '',
            standardContractType: 'raw-array',
            chain: this.defaultChain,
            method: 'contains',
            parameters: [condition.attribute, JSON.stringify(condition.value)],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.CONTAINS:
          return {
            contractAddress: '',
            standardContractType: 'raw-string',
            chain: this.defaultChain,
            method: 'contains',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.MATCHES:
          return {
            contractAddress: '',
            standardContractType: 'raw-regex',
            chain: this.defaultChain,
            method: 'matches',
            parameters: [condition.attribute, condition.value.toString()],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.AND:
          return {
            contractAddress: '',
            standardContractType: 'raw-boolean',
            chain: this.defaultChain,
            method: 'and',
            parameters: (condition.value as Condition[]).map(c => 
              JSON.stringify(this.convertCondition(c))
            ),
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.OR:
          return {
            contractAddress: '',
            standardContractType: 'raw-boolean',
            chain: this.defaultChain,
            method: 'or',
            parameters: (condition.value as Condition[]).map(c => 
              JSON.stringify(this.convertCondition(c))
            ),
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        case ConditionOperator.NOT:
          return {
            contractAddress: '',
            standardContractType: 'raw-boolean',
            chain: this.defaultChain,
            method: 'not',
            parameters: [
              JSON.stringify(
                this.convertCondition(condition.value as Condition)
              )
            ],
            returnValueTest: {
              comparator: 'equals',
              value: 'true'
            }
          };

        default:
          throw new Error(`Unsupported condition operator: ${condition.operator}`);
      }
    } catch (error) {
      logger.error('Failed to convert condition to Lit condition', {
        error,
        condition
      });
      throw error;
    }
  }

  /**
   * Generate Lit Protocol signing conditions from a policy
   */
  public generateSigningConditions(policy: Policy): string {
    try {
      const conditions = this.convertPolicy(policy);
      return JSON.stringify(conditions, null, 2);
    } catch (error) {
      logger.error('Failed to generate signing conditions', { error, policy });
      throw error;
    }
  }

  /**
   * Validate Lit Protocol conditions
   */
  public validateConditions(conditions: LitAccessControlCondition[]): boolean {
    try {
      for (const condition of conditions) {
        this.validateCondition(condition);
      }
      return true;
    } catch (error) {
      logger.error('Invalid Lit conditions', { error, conditions });
      return false;
    }
  }

  /**
   * Validate a single Lit Protocol condition
   */
  private validateCondition(condition: LitAccessControlCondition): void {
    if (!condition.contractAddress) {
      throw new Error('Contract address is required');
    }

    if (!condition.standardContractType) {
      throw new Error('Standard contract type is required');
    }

    if (!condition.chain) {
      throw new Error('Chain is required');
    }

    if (!condition.method) {
      throw new Error('Method is required');
    }

    if (!Array.isArray(condition.parameters)) {
      throw new Error('Parameters must be an array');
    }

    if (!condition.returnValueTest) {
      throw new Error('Return value test is required');
    }

    if (!condition.returnValueTest.comparator) {
      throw new Error('Return value test comparator is required');
    }

    if (condition.returnValueTest.value === undefined) {
      throw new Error('Return value test value is required');
    }
  }
} 
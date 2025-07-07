import { KYCStats, EncryptionStats, CostStats, PerformanceStats, AnalyticsData } from '../types/analytics';

/**
 * Convert snake_case database results to camelCase interface format
 */
export class DataTransformer {
  /**
   * Transform KYC stats from database format
   */
  static transformKYCStats(stats: KYCStats | undefined): KYCStats | undefined {
    if (!stats) return undefined;
    return {
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      avg_duration: stats.avg_duration
    };
  }

  /**
   * Transform encryption stats from database format
   */
  static transformEncryptionStats(stats: EncryptionStats | undefined): EncryptionStats | undefined {
    if (!stats) return undefined;
    return {
      operations: stats.operations,
      failures: stats.failures,
      avg_duration: stats.avg_duration
    };
  }

  /**
   * Transform cost stats from database format
   */
  static transformCostStats(stats: CostStats | undefined): CostStats | undefined {
    if (!stats) return undefined;
    return {
      total_cost: stats.total_cost,
      operation: stats.operation,
      operation_cost: stats.operation_cost
    };
  }

  /**
   * Transform performance stats from database format
   */
  static transformPerformanceStats(stats: PerformanceStats | undefined): PerformanceStats | undefined {
    if (!stats) return undefined;
    return {
      p50: stats.p50,
      p95: stats.p95,
      p99: stats.p99
    };
  }

  /**
   * Transform complete analytics data
   */
  static transformAnalyticsData(data: Partial<AnalyticsData>): AnalyticsData {
    return {
      kycStats: this.transformKYCStats(data.kycStats),
      encryptionStats: this.transformEncryptionStats(data.encryptionStats),
      costStats: this.transformCostStats(data.costStats),
      performanceStats: this.transformPerformanceStats(data.performanceStats)
    };
  }
} 
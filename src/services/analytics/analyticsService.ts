import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { Metric, AnalyticsData, AnalyticsEvent, CostMetric } from '../../types/analytics';
import { RedisService } from '../cache/redisService';
import { DataTransformer } from '../../utils/dataTransform';
import { logger } from '../../utils/logger';

export class AnalyticsService {
  private static instance: AnalyticsService;
  private pool: Pool;
  private redisService: RedisService;

  private constructor(pool: Pool) {
    this.pool = pool;
    this.redisService = RedisService.getInstance();
  }

  public static getInstance(pool?: Pool): AnalyticsService {
    if (!AnalyticsService.instance && pool) {
      AnalyticsService.instance = new AnalyticsService(pool);
    }
    return AnalyticsService.instance;
  }

  public async recordMetric(metric: Metric): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO metrics (type, duration, project_id, user_id, success, error, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          metric.type,
          metric.duration,
          metric.projectId,
          metric.userId,
          metric.success,
          metric.error,
          JSON.stringify(metric)
        ]
      );
    } catch (error) {
      logger.error('Failed to record metric:', { error });
    }
  }

  public async recordEvent(event: Partial<AnalyticsEvent>): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO events (id, type, project_id, timestamp, data) VALUES ($1, $2, $3, $4, $5)',
        [
          event.id || uuidv4(),
          event.type,
          event.projectId,
          event.timestamp || new Date(),
          JSON.stringify(event.data)
        ]
      );
    } catch (error) {
      logger.error('Failed to record event:', { error });
    }
  }

  public async trackCost(costMetric: CostMetric): Promise<void> {
    try {
      await this.pool.query(
        'INSERT INTO cost_metrics (project_id, operation, cost, network, success, timestamp, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          costMetric.projectId,
          costMetric.operation,
          costMetric.cost,
          costMetric.network,
          costMetric.success,
          costMetric.timestamp || new Date(),
          costMetric.metadata ? JSON.stringify(costMetric.metadata) : null
        ]
      );
    } catch (error) {
      logger.error('Failed to track cost:', { error });
    }
  }

  public async getAnalytics(projectId: string, startDate: Date, endDate: Date): Promise<AnalyticsData> {
    try {
      const cacheKey = `analytics:${projectId}:${startDate.toISOString()}:${endDate.toISOString()}`;
      const cachedData = await this.redisService.get<AnalyticsData>(cacheKey);
      if (cachedData) return DataTransformer.transformAnalyticsData(cachedData);

      const [kycStats, encryptionStats, costStats, performanceStats] = await Promise.all([
        this.getKYCStats(projectId, startDate, endDate),
        this.getEncryptionStats(projectId, startDate, endDate),
        this.getCostStats(projectId, startDate, endDate),
        this.getPerformanceStats(projectId, startDate, endDate)
      ]);

      const data: AnalyticsData = DataTransformer.transformAnalyticsData({
        kycStats: kycStats.rows[0],
        encryptionStats: encryptionStats.rows[0],
        costStats: costStats.rows[0],
        performanceStats: performanceStats.rows[0]
      });

      await this.redisService.set(cacheKey, data, 300); // Cache for 5 minutes
      return data;
    } catch (error) {
      logger.error('Failed to get analytics:', { error });
      throw error;
    }
  }

  private async getKYCStats(projectId: string, startDate: Date, endDate: Date) {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failed,
        AVG(duration) as avg_duration
      FROM metrics
      WHERE project_id = $1
        AND type = 'kyc'
        AND timestamp BETWEEN $2 AND $3
    `, [projectId, startDate, endDate]);

    return result;
  }

  private async getEncryptionStats(projectId: string, startDate: Date, endDate: Date) {
    const result = await this.pool.query(`
      SELECT 
        COUNT(*) as operations,
        SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as failures,
        AVG(duration) as avg_duration
      FROM metrics
      WHERE project_id = $1
        AND type IN ('encryption', 'decryption')
        AND timestamp BETWEEN $2 AND $3
    `, [projectId, startDate, endDate]);

    return result;
  }

  private async getCostStats(projectId: string, startDate: Date, endDate: Date) {
    const result = await this.pool.query(`
      SELECT 
        SUM(metadata->>'cost') as total_cost,
        metadata->>'operation' as operation,
        SUM(metadata->>'cost') as operation_cost
      FROM metrics
      WHERE project_id = $1
        AND timestamp BETWEEN $2 AND $3
      GROUP BY metadata->>'operation'
    `, [projectId, startDate, endDate]);

    return result;
  }

  private async getPerformanceStats(projectId: string, startDate: Date, endDate: Date) {
    const result = await this.pool.query(`
      SELECT 
        percentile_cont(0.50) WITHIN GROUP (ORDER BY duration) as p50,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY duration) as p95,
        percentile_cont(0.99) WITHIN GROUP (ORDER BY duration) as p99
      FROM metrics
      WHERE project_id = $1
        AND timestamp BETWEEN $2 AND $3
    `, [projectId, startDate, endDate]);

    return result;
  }
} 
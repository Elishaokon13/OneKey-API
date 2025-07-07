import { Pool } from 'pg';
import { AnalyticsService } from '../../services/analytics/analyticsService';
import { MetricType, AnalyticsEvent } from '../../types/analytics';
import { RedisService } from '../../services/cache/redisService';

jest.mock('pg');
jest.mock('../../services/cache/redisService');

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPool: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<RedisService>;

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    } as unknown as jest.Mocked<Pool>;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      connect: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    jest.spyOn(RedisService, 'getInstance').mockReturnValue(mockRedis);
    service = AnalyticsService.getInstance(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMetric', () => {
    const mockMetric = {
      type: MetricType.API_REQUEST,
      duration: 100,
      projectId: 'project123',
      success: true
    };

    it('should record metric successfully', async () => {
      await service.recordMetric(mockMetric);

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO metrics (type, duration, project_id, user_id, success, error, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          mockMetric.type,
          mockMetric.duration,
          mockMetric.projectId,
          undefined,
          mockMetric.success,
          undefined,
          expect.any(String)
        ]
      );
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await service.recordMetric(mockMetric);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record metric:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('recordEvent', () => {
    const mockEvent: Partial<AnalyticsEvent> = {
      type: 'user_action',
      projectId: 'project123',
      data: { action: 'login' }
    };

    it('should record event successfully', async () => {
      await service.recordEvent(mockEvent);

      expect(mockPool.query).toHaveBeenCalledWith(
        'INSERT INTO events (id, type, project_id, timestamp, data) VALUES ($1, $2, $3, $4, $5)',
        [
          expect.any(String),
          mockEvent.type,
          mockEvent.projectId,
          expect.any(Date),
          JSON.stringify(mockEvent.data)
        ]
      );
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await service.recordEvent(mockEvent);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to record event:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('getAnalytics', () => {
    const projectId = 'project123';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-01-31');

    const mockQueryResults = {
      kycStats: {
        rows: [{
          total: '100',
          successful: '90',
          failed: '10',
          avg_duration: '150.5'
        }]
      },
      encryptionStats: {
        rows: [{
          operations: '200',
          failures: '5',
          avg_duration: '75.3'
        }]
      },
      costStats: {
        rows: [{
          total_cost: '1000.50',
          operation: 'encryption',
          operation_cost: '500.25'
        }]
      },
      performanceStats: {
        rows: [{
          p50: '100',
          p95: '200',
          p99: '300'
        }]
      }
    };

    it('should return analytics data successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce(mockQueryResults.kycStats)
        .mockResolvedValueOnce(mockQueryResults.encryptionStats)
        .mockResolvedValueOnce(mockQueryResults.costStats)
        .mockResolvedValueOnce(mockQueryResults.performanceStats);

      mockRedis.get.mockResolvedValueOnce(null);

      const result = await service.getAnalytics(projectId, startDate, endDate);

      expect(result).toEqual({
        kycStats: mockQueryResults.kycStats.rows[0],
        encryptionStats: mockQueryResults.encryptionStats.rows[0],
        costStats: mockQueryResults.costStats.rows[0],
        performanceStats: mockQueryResults.performanceStats.rows[0]
      });

      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('analytics:project123'),
        expect.any(Object),
        300
      );
    });

    it('should return cached data if available', async () => {
      const cachedData = {
        kycStats: { total: 100 },
        encryptionStats: { operations: 200 },
        costStats: { total_cost: 1000.50 },
        performanceStats: { p50: 100 }
      };

      mockRedis.get.mockResolvedValueOnce(cachedData);

      const result = await service.getAnalytics(projectId, startDate, endDate);

      expect(result).toEqual(cachedData);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database error');
      mockRedis.get.mockResolvedValueOnce(null);
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.getAnalytics(projectId, startDate, endDate))
        .rejects.toThrow(error);
    });

    it('should handle empty results', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await service.getAnalytics(projectId, startDate, endDate);

      expect(result).toEqual({
        kycStats: undefined,
        encryptionStats: undefined,
        costStats: undefined,
        performanceStats: undefined
      });
    });
  });
});
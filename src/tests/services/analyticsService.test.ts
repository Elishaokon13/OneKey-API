import { Pool } from 'pg';
import { AnalyticsService } from '../../services/analytics/analyticsService';
import { 
  AnalyticsEventType,
  MetricType,
  AnalyticsEvent,
  PerformanceMetric,
  CostMetric
} from '../../types/analytics';

// Mock pg Pool
jest.mock('pg', () => {
  const mockQuery = jest.fn();
  return {
    Pool: jest.fn().mockImplementation(() => ({
      query: mockQuery,
      connect: jest.fn(),
      end: jest.fn()
    }))
  };
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockPool: jest.Mocked<Pool>;

  beforeEach(() => {
    mockPool = new Pool() as jest.Mocked<Pool>;
    service = new AnalyticsService(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('trackEvent', () => {
    const mockEvent: Omit<AnalyticsEvent, 'id' | 'timestamp'> = {
      type: AnalyticsEventType.KYC_STARTED,
      projectId: 'proj123',
      userId: 'user123',
      metadata: { provider: 'test' },
      duration: 100
    };

    it('should successfully track an event', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.trackEvent(mockEvent);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO analytics_events'),
        expect.arrayContaining([
          expect.any(String), // id
          mockEvent.type,
          mockEvent.projectId,
          mockEvent.userId,
          mockEvent.metadata,
          mockEvent.duration,
          expect.any(Date) // timestamp
        ])
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.trackEvent(mockEvent)).rejects.toThrow('Database error');
    });
  });

  describe('recordMetric', () => {
    const mockMetric: Omit<PerformanceMetric, 'timestamp'> = {
      name: 'test_metric',
      type: MetricType.HISTOGRAM,
      value: 100,
      tags: { operation: 'test' },
      projectId: 'proj123'
    };

    it('should successfully record a metric', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.recordMetric(mockMetric);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO performance_metrics'),
        expect.arrayContaining([
          mockMetric.name,
          mockMetric.type,
          mockMetric.value,
          mockMetric.tags,
          mockMetric.projectId,
          expect.any(Date) // timestamp
        ])
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.recordMetric(mockMetric)).rejects.toThrow('Database error');
    });
  });

  describe('trackCost', () => {
    const mockCost: Omit<CostMetric, 'timestamp'> = {
      projectId: 'proj123',
      operation: 'saveEncryptionKey',
      cost: 1000000,
      network: 'base',
      success: true,
      metadata: { conditionsCount: 2 }
    };

    it('should successfully track a cost metric', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.trackCost(mockCost);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO cost_metrics'),
        expect.arrayContaining([
          mockCost.projectId,
          mockCost.operation,
          mockCost.cost,
          mockCost.network,
          mockCost.success,
          mockCost.metadata,
          expect.any(Date) // timestamp
        ])
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.trackCost(mockCost)).rejects.toThrow('Database error');
    });
  });

  describe('getProjectMetrics', () => {
    const projectId = 'proj123';
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-02-01');

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
        rows: [
          { total_cost: '1000000', operation: 'saveEncryptionKey', operation_cost: '600000' },
          { total_cost: '1000000', operation: 'getEncryptionKey', operation_cost: '400000' }
        ]
      },
      performanceStats: {
        rows: [{
          p50: '100',
          p95: '200',
          p99: '300'
        }]
      }
    };

    it('should return aggregated project metrics', async () => {
      mockPool.query
        .mockResolvedValueOnce(mockQueryResults.kycStats)
        .mockResolvedValueOnce(mockQueryResults.encryptionStats)
        .mockResolvedValueOnce(mockQueryResults.costStats)
        .mockResolvedValueOnce(mockQueryResults.performanceStats);

      const metrics = await service.getProjectMetrics(projectId, startDate, endDate);

      expect(metrics).toEqual({
        projectId,
        period: { start: startDate, end: endDate },
        kycStats: {
          total: 100,
          successful: 90,
          failed: 10,
          averageDuration: 150.5
        },
        encryptionStats: {
          operations: 200,
          failures: 5,
          averageDuration: 75.3
        },
        costs: {
          total: 1000000,
          byOperation: {
            saveEncryptionKey: 600000,
            getEncryptionKey: 400000
          }
        },
        performance: {
          p50: 100,
          p95: 200,
          p99: 300
        }
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.getProjectMetrics(projectId, startDate, endDate))
        .rejects.toThrow('Database error');
    });

    it('should handle empty results', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const metrics = await service.getProjectMetrics(projectId, startDate, endDate);

      expect(metrics).toEqual({
        projectId,
        period: { start: startDate, end: endDate },
        kycStats: {
          total: 0,
          successful: 0,
          failed: 0,
          averageDuration: 0
        },
        encryptionStats: {
          operations: 0,
          failures: 0,
          averageDuration: 0
        },
        costs: {
          total: 0,
          byOperation: {}
        },
        performance: {
          p50: 0,
          p95: 0,
          p99: 0
        }
      });
    });
  });

  describe('queryEvents', () => {
    const mockFilter = {
      projectId: 'proj123',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-02-01'),
      eventTypes: [AnalyticsEventType.KYC_STARTED],
      userId: 'user123'
    };

    it('should query events with all filters', async () => {
      const mockEvents = [
        { id: '1', type: AnalyticsEventType.KYC_STARTED, projectId: 'proj123' }
      ];
      mockPool.query.mockResolvedValueOnce({ rows: mockEvents });

      const events = await service.queryEvents(mockFilter);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM analytics_events'),
        expect.arrayContaining([
          mockFilter.projectId,
          mockFilter.startDate,
          mockFilter.endDate,
          mockFilter.eventTypes,
          mockFilter.userId
        ])
      );
      expect(events).toEqual(mockEvents);
    });

    it('should handle partial filters', async () => {
      const partialFilter = { projectId: 'proj123' };
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await service.queryEvents(partialFilter);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('project_id = $1'),
        expect.arrayContaining([partialFilter.projectId])
      );
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockPool.query.mockRejectedValueOnce(error);

      await expect(service.queryEvents(mockFilter)).rejects.toThrow('Database error');
    });
  });
});
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import { AnalyticsService } from '../../services/analytics/analyticsService';
import { MetricType } from '../../types/analytics';

// Mock AnalyticsService
jest.mock('../../services/analytics/analyticsService');

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;
  const projectId = 'proj123';

  beforeEach(() => {
    mockAnalyticsService = new AnalyticsService({} as any) as jest.Mocked<AnalyticsService>;
    monitor = new PerformanceMonitor(mockAnalyticsService, projectId);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('startMeasurement and endMeasurement', () => {
    it('should measure operation duration', async () => {
      const operation = 'testOperation';
      const tags = { type: 'test' };

      monitor.startMeasurement(operation);
      await new Promise(resolve => setTimeout(resolve, 10)); // Simulate work
      const duration = await monitor.endMeasurement(operation, tags);

      expect(duration).toBeGreaterThan(0);
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith({
        name: `${operation}_duration`,
        type: MetricType.HISTOGRAM,
        value: expect.any(Number),
        tags: { operation, ...tags },
        projectId
      });
    });

    it('should handle missing start time', async () => {
      const operation = 'missingOperation';
      const duration = await monitor.endMeasurement(operation);

      expect(duration).toBe(0);
      expect(mockAnalyticsService.recordMetric).not.toHaveBeenCalled();
    });

    it('should handle analytics service errors', async () => {
      const operation = 'errorOperation';
      mockAnalyticsService.recordMetric.mockRejectedValueOnce(new Error('Analytics error'));

      monitor.startMeasurement(operation);
      const duration = await monitor.endMeasurement(operation);

      expect(duration).toBeGreaterThan(0);
    });
  });

  describe('recordMetric', () => {
    it('should record a single metric', async () => {
      const name = 'testMetric';
      const value = 100;
      const type = MetricType.GAUGE;
      const tags = { type: 'test' };

      await monitor.recordMetric(name, value, type, tags);

      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith({
        name,
        type,
        value,
        tags,
        projectId
      });
    });

    it('should use default metric type', async () => {
      const name = 'testMetric';
      const value = 100;

      await monitor.recordMetric(name, value);

      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith({
        name,
        type: MetricType.GAUGE,
        value,
        tags: {},
        projectId
      });
    });

    it('should handle analytics service errors', async () => {
      const name = 'errorMetric';
      mockAnalyticsService.recordMetric.mockRejectedValueOnce(new Error('Analytics error'));

      await monitor.recordMetric(name, 100);
      // Should not throw
    });
  });

  describe('recordMemoryUsage', () => {
    it('should record all memory metrics', async () => {
      await monitor.recordMemoryUsage();

      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledTimes(4);
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'memory_heap_used',
          type: MetricType.GAUGE,
          tags: { type: 'heap' }
        })
      );
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'memory_heap_total',
          type: MetricType.GAUGE,
          tags: { type: 'heap' }
        })
      );
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'memory_external',
          type: MetricType.GAUGE,
          tags: { type: 'external' }
        })
      );
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'memory_rss',
          type: MetricType.GAUGE,
          tags: { type: 'rss' }
        })
      );
    });

    it('should handle analytics service errors', async () => {
      mockAnalyticsService.recordMetric.mockRejectedValue(new Error('Analytics error'));

      await monitor.recordMemoryUsage();
      // Should not throw
    });
  });

  describe('measureOperation', () => {
    it('should measure async operation duration', async () => {
      const operation = 'asyncOperation';
      const tags = { type: 'async' };
      const result = 'success';
      const func = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return result;
      };

      const response = await monitor.measureOperation(operation, func, tags);

      expect(response).toBe(result);
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${operation}_duration`,
          type: MetricType.HISTOGRAM,
          tags: { operation, ...tags }
        })
      );
    });

    it('should handle operation errors', async () => {
      const operation = 'errorOperation';
      const error = new Error('Operation failed');
      const func = async () => {
        throw error;
      };

      await expect(monitor.measureOperation(operation, func)).rejects.toThrow(error);
      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          name: `${operation}_duration`,
          type: MetricType.HISTOGRAM,
          tags: { operation, error: 'true' }
        })
      );
    });
  });

  describe('clearMeasurements', () => {
    it('should clear all measurements', async () => {
      monitor.startMeasurement('op1');
      monitor.startMeasurement('op2');
      monitor.clearMeasurements();

      const duration = await monitor.endMeasurement('op1');
      expect(duration).toBe(0);
    });
  });
});
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import { AnalyticsService } from '../../services/analytics/analyticsService';
import { MetricType } from '../../types/analytics';

jest.mock('../../services/analytics/analyticsService');

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockAnalyticsService: jest.Mocked<AnalyticsService>;

  beforeEach(() => {
    mockAnalyticsService = {
      recordMetric: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<AnalyticsService>;

    jest.spyOn(AnalyticsService, 'getInstance').mockReturnValue(mockAnalyticsService);
    monitor = PerformanceMonitor.getInstance();
  });

  afterEach(() => {
    monitor.clearMetrics();
    jest.clearAllMocks();
  });

  describe('startMetric and endMetric', () => {
    it('should record duration between start and end', async () => {
      const metricId = 'test-operation';
      const data = { projectId: 'test-project' };
      const type = MetricType.API_REQUEST;

      monitor.startMetric(metricId, data);
      await new Promise(resolve => setTimeout(resolve, 100));
      monitor.endMetric(metricId, type);

      expect(mockAnalyticsService.recordMetric).toHaveBeenCalledWith(expect.objectContaining({
        type,
        duration: expect.any(Number),
        projectId: data.projectId
      }));
    });

    it('should handle missing metric gracefully', () => {
      const metricId = 'non-existent';
      const type = MetricType.API_REQUEST;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      monitor.endMetric(metricId, type);

      expect(consoleSpy).toHaveBeenCalledWith(`No metric found with ID: ${metricId}`);
      expect(mockAnalyticsService.recordMetric).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('clearMetrics', () => {
    it('should clear all metrics', () => {
      const metricId = 'test-operation';
      monitor.startMetric(metricId);
      monitor.clearMetrics();
      monitor.endMetric(metricId, MetricType.API_REQUEST);

      expect(mockAnalyticsService.recordMetric).not.toHaveBeenCalled();
    });
  });
});
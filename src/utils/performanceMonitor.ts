import { AnalyticsService } from '../services/analytics/analyticsService';
import { MetricType } from '../types/analytics';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private analyticsService: AnalyticsService;
  private metrics: Map<string, { startTime: number; data: any }>;

  private constructor() {
    this.analyticsService = AnalyticsService.getInstance();
    this.metrics = new Map();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public startMetric(metricId: string, data: any = {}): void {
    this.metrics.set(metricId, {
      startTime: Date.now(),
      data
    });
  }

  public endMetric(metricId: string, type: MetricType): void {
    const metric = this.metrics.get(metricId);
    if (!metric) {
      console.warn(`No metric found with ID: ${metricId}`);
      return;
    }

    const duration = Date.now() - metric.startTime;
    this.analyticsService.recordMetric({
      type,
      duration,
      ...metric.data
    });

    this.metrics.delete(metricId);
  }

  public clearMetrics(): void {
    this.metrics.clear();
  }
} 
export enum MetricType {
  ENCRYPTION = 'encryption',
  DECRYPTION = 'decryption',
  ACCESS_CONTROL = 'access_control',
  API_REQUEST = 'api_request',
  DATABASE_QUERY = 'database_query'
}

export interface Metric {
  type: MetricType;
  duration: number;
  projectId?: string;
  userId?: string;
  success?: boolean;
  error?: string;
  [key: string]: any;
}

export interface KYCStats {
  total: string;
  successful: string;
  failed: string;
  avg_duration: string;
}

export interface EncryptionStats {
  operations: string;
  failures: string;
  avg_duration: string;
}

export interface CostStats {
  total_cost: string;
  operation: string;
  operation_cost: string;
}

export interface PerformanceStats {
  p50: string;
  p95: string;
  p99: string;
}

export interface AnalyticsData {
  kycStats?: KYCStats;
  encryptionStats?: EncryptionStats;
  costStats?: CostStats;
  performanceStats?: PerformanceStats;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  projectId: string;
  timestamp: Date;
  data: Record<string, any>;
}

export interface CostMetric {
  projectId: string;
  operation: string;
  cost: number;
  network: string;
  success: boolean;
  timestamp?: Date;
  metadata?: Record<string, any>;
} 
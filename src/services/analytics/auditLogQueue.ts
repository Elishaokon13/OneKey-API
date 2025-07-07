import { RedisService } from '../cache/redisService';
import { knex } from '@/config/database';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';

export interface AuditLogEntry {
  user_id: string;
  project_id: string;
  action: string;
  allowed: boolean;
  details: Record<string, any>;
  created_at: Date;
  resource_type?: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  request_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
}

export class AuditLogQueue {
  private static instance: AuditLogQueue;
  private redis: RedisService;
  private readonly QUEUE_KEY = 'audit_logs:queue';
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private constructor() {
    this.redis = RedisService.getInstance();
    this.startProcessing();
  }

  public static getInstance(): AuditLogQueue {
    if (!AuditLogQueue.instance) {
      AuditLogQueue.instance = new AuditLogQueue();
    }
    return AuditLogQueue.instance;
  }

  /**
   * Add an audit log entry to the queue
   */
  public async enqueue(entry: AuditLogEntry): Promise<void> {
    if (!this.redis.isEnabled()) {
      // If Redis is not available, write directly to database
      await this.writeToDatabase([entry]);
      return;
    }

    try {
      await this.redis.getClient()?.rpush(
        this.QUEUE_KEY,
        JSON.stringify({
          ...entry,
          created_at: entry.created_at.toISOString()
        })
      );
      logger.debug('Audit log entry queued', { action: entry.action });
    } catch (error) {
      logger.error('Failed to queue audit log entry', { error });
      // Fallback to direct database write
      await this.writeToDatabase([entry]);
    }
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.processingInterval) {
      return;
    }

    this.processingInterval = setInterval(async () => {
      if (this.isProcessing || !this.redis.isEnabled()) {
        return;
      }

      try {
        this.isProcessing = true;
        await this.processBatch();
      } catch (error) {
        logger.error('Error processing audit log batch', { error });
      } finally {
        this.isProcessing = false;
      }
    }, this.BATCH_TIMEOUT);

    logger.info('Audit log queue processor started', {
      batchSize: this.BATCH_SIZE,
      batchTimeout: this.BATCH_TIMEOUT
    });
  }

  /**
   * Process a batch of audit logs
   */
  private async processBatch(): Promise<void> {
    const client = this.redis.getClient();
    if (!client) return;

    const batch: AuditLogEntry[] = [];
    
    // Use multi to ensure atomic operations
    const multi = client.multi();

    // Get batch of items from queue
    for (let i = 0; i < this.BATCH_SIZE; i++) {
      multi.lpop(this.QUEUE_KEY);
    }

    const results = await multi.exec();
    if (!results) return;

    // Process results
    for (const [err, item] of results) {
      if (err || !item) continue;
      try {
        const entry = JSON.parse(item as string);
        entry.created_at = new Date(entry.created_at);
        batch.push(entry);
      } catch (error) {
        logger.error('Failed to parse audit log entry', { error, item });
      }
    }

    if (batch.length > 0) {
      await this.writeToDatabase(batch);
      logger.debug('Processed audit log batch', { count: batch.length });
    }
  }

  /**
   * Write audit logs to database
   */
  private async writeToDatabase(entries: AuditLogEntry[]): Promise<void> {
    try {
      await knex('audit_logs').insert(entries);
    } catch (error) {
      logger.error('Failed to write audit logs to database', { error, count: entries.length });
      // In case of database error, we could implement a retry mechanism or dead letter queue
    }
  }

  /**
   * Stop processing the queue
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Get queue length
   */
  public async getQueueLength(): Promise<number> {
    if (!this.redis.isEnabled()) {
      return 0;
    }
    return await this.redis.getClient()?.llen(this.QUEUE_KEY) || 0;
  }
} 
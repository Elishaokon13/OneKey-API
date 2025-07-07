import { AuditLogQueue, AuditLogEntry } from '@/services/analytics/auditLogQueue';
import { RedisService } from '@/services/cache/redisService';
import { knex } from '@/config/database';
import { config } from '@/config/environment';

describe('AuditLogQueue', () => {
  let auditLogQueue: AuditLogQueue;
  let redisService: RedisService;

  beforeAll(async () => {
    // Ensure Redis is enabled for tests
    config.redis.enabled = true;
    redisService = RedisService.getInstance();
    auditLogQueue = AuditLogQueue.getInstance();
  });

  beforeEach(async () => {
    // Clear Redis queue and database before each test
    await redisService.getClient()?.del('audit_logs:queue');
    await knex('audit_logs').del();
  });

  afterAll(async () => {
    auditLogQueue.stop();
    await redisService.disconnect();
  });

  const mockAuditLog: AuditLogEntry = {
    user_id: '123',
    project_id: '456',
    action: 'test:action',
    allowed: true,
    details: { test: 'data' },
    created_at: new Date()
  };

  describe('enqueue', () => {
    it('should add audit log to queue when Redis is available', async () => {
      await auditLogQueue.enqueue(mockAuditLog);
      const queueLength = await auditLogQueue.getQueueLength();
      expect(queueLength).toBe(1);
    });

    it('should write directly to database when Redis is disabled', async () => {
      // Temporarily disable Redis
      const originalEnabled = config.redis.enabled;
      config.redis.enabled = false;

      await auditLogQueue.enqueue(mockAuditLog);
      
      // Check database
      const logs = await knex('audit_logs').select('*');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(mockAuditLog.action);

      // Restore Redis config
      config.redis.enabled = originalEnabled;
    });
  });

  describe('batch processing', () => {
    it('should process queued audit logs in batches', async () => {
      // Add multiple logs
      for (let i = 0; i < 5; i++) {
        await auditLogQueue.enqueue({
          ...mockAuditLog,
          action: `test:action:${i}`
        });
      }

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Check database
      const logs = await knex('audit_logs').select('*');
      expect(logs).toHaveLength(5);
      expect(logs.map(log => log.action)).toContain('test:action:0');
    });

    it('should handle invalid JSON in queue', async () => {
      // Add invalid entry directly to Redis
      await redisService.getClient()?.rpush('audit_logs:queue', 'invalid json');
      await auditLogQueue.enqueue(mockAuditLog);

      // Wait for batch processing
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Check database - should only have the valid entry
      const logs = await knex('audit_logs').select('*');
      expect(logs).toHaveLength(1);
      expect(logs[0].action).toBe(mockAuditLog.action);
    });
  });

  describe('queue management', () => {
    it('should report correct queue length', async () => {
      await auditLogQueue.enqueue(mockAuditLog);
      await auditLogQueue.enqueue(mockAuditLog);
      
      const length = await auditLogQueue.getQueueLength();
      expect(length).toBe(2);
    });

    it('should stop processing when requested', async () => {
      auditLogQueue.stop();
      await auditLogQueue.enqueue(mockAuditLog);

      // Wait brief period
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Queue should still have the entry
      const length = await auditLogQueue.getQueueLength();
      expect(length).toBe(1);
    });
  });
}); 
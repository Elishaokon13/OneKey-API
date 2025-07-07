import { RateLimitService } from '../../../services/access/rateLimitService';
import { RedisService } from '../../../services/cache/redisService';

jest.mock('../../../services/cache/redisService');

describe('RateLimitService', () => {
  let service: RateLimitService;
  let mockRedis: jest.Mocked<RedisService>;

  const testUserId = 'user123';
  const testProjectId = 'project456';

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      connect: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    jest.spyOn(RedisService, 'getInstance').mockReturnValue(mockRedis);
    service = RateLimitService.getInstance();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRateLimited', () => {
    it('should return false when request count is below limit', async () => {
      mockRedis.get.mockResolvedValue(10);
      const result = await service.isRateLimited(testUserId, testProjectId);
      expect(result).toBe(false);
    });

    it('should return true when request count is at or above limit', async () => {
      mockRedis.get.mockResolvedValue(50);
      const result = await service.isRateLimited(testUserId, testProjectId);
      expect(result).toBe(true);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      const result = await service.isRateLimited(testUserId, testProjectId);
      expect(result).toBe(false);
    });
  });

  describe('incrementRequestCount', () => {
    it('should increment request count', async () => {
      mockRedis.get.mockResolvedValue(5);
      mockRedis.set.mockResolvedValue(true);

      await service.incrementRequestCount(testUserId, testProjectId);
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`rate_limit:${testUserId}:${testProjectId}`),
        6,
        300
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));
      await service.incrementRequestCount(testUserId, testProjectId);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('blockUser', () => {
    it('should set request count to limit', async () => {
      mockRedis.set.mockResolvedValue(true);

      await service.blockUser(testUserId, testProjectId);
      
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining(`rate_limit:${testUserId}:${testProjectId}`),
        50,
        300
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.set.mockRejectedValue(new Error('Redis error'));
      await service.blockUser(testUserId, testProjectId);
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('resetLimits', () => {
    it('should delete rate limit key', async () => {
      mockRedis.del.mockResolvedValue(true);

      await service.resetLimits(testUserId, testProjectId);
      
      expect(mockRedis.del).toHaveBeenCalledWith(
        expect.stringContaining(`rate_limit:${testUserId}:${testProjectId}`)
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));
      await service.resetLimits(testUserId, testProjectId);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });
}); 
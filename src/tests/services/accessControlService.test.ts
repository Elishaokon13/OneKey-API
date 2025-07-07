import { Pool } from 'pg';
import { AccessControlService } from '../../services/auth/accessControlService';
import { RedisService } from '../../services/cache/redisService';
import { RateLimitService } from '../../services/access/rateLimitService';
import { AccessLevel, ProjectType, Permission } from '../../types/accessControl';

jest.mock('pg');
jest.mock('../../services/cache/redisService');
jest.mock('../../services/access/rateLimitService');

describe('AccessControlService', () => {
  let service: AccessControlService;
  let mockPool: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<RedisService>;
  let mockRateLimiter: jest.Mocked<RateLimitService>;

  const testUser = {
    id: 'user123',
    role: 'user'
  };

  const testProject = {
    id: 'project456',
    type: ProjectType.WEB3
  };

  beforeEach(() => {
    mockPool = {
      query: jest.fn()
    } as unknown as jest.Mocked<Pool>;

    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      connect: jest.fn()
    } as unknown as jest.Mocked<RedisService>;

    mockRateLimiter = {
      isRateLimited: jest.fn(),
      incrementRequestCount: jest.fn(),
      blockUser: jest.fn(),
      resetLimits: jest.fn()
    } as unknown as jest.Mocked<RateLimitService>;

    jest.spyOn(RedisService, 'getInstance').mockReturnValue(mockRedis);
    jest.spyOn(RateLimitService, 'getInstance').mockReturnValue(mockRateLimiter);

    service = AccessControlService.getInstance(mockPool);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hasPermission', () => {
    it('should return true when user has required permission', async () => {
      const permission: Permission = 'api:read';
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          accessLevel: AccessLevel.READ,
          projectType: ProjectType.WEB3
        }]
      });

      const result = await service.hasPermission(testUser.id, testProject.id, permission);
      expect(result).toBe(true);
    });

    it('should return false when user does not have required permission', async () => {
      const permission: Permission = 'api:write';
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          accessLevel: AccessLevel.READ,
          projectType: ProjectType.WEB3
        }]
      });

      const result = await service.hasPermission(testUser.id, testProject.id, permission);
      expect(result).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      const permission: Permission = 'api:read';
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.hasPermission(testUser.id, testProject.id, permission);
      expect(result).toBe(false);
    });
  });

  describe('getAccessPolicy', () => {
    const policy = {
      userId: testUser.id,
      projectId: testProject.id,
      accessLevel: AccessLevel.READ,
      projectType: ProjectType.WEB3
    };

    it('should return cached policy when available', async () => {
      mockRedis.get.mockResolvedValueOnce(policy);

      const result = await service.getAccessPolicy(testUser.id, testProject.id);
      expect(result).toEqual(policy);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    it('should fetch and cache policy when not in cache', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPool.query.mockResolvedValueOnce({ rows: [policy] });
      mockRedis.set.mockResolvedValueOnce(true);

      const result = await service.getAccessPolicy(testUser.id, testProject.id);
      expect(result).toEqual(policy);
      expect(mockPool.query).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await service.getAccessPolicy(testUser.id, testProject.id);
      expect(result).toBeNull();
    });
  });

  describe('isRateLimited', () => {
    it('should return true when rate limited', async () => {
      mockRateLimiter.isRateLimited.mockResolvedValueOnce(true);

      const result = await service.isRateLimited(testUser.id, testProject.id);
      expect(result).toBe(true);
    });

    it('should return false when not rate limited', async () => {
      mockRateLimiter.isRateLimited.mockResolvedValueOnce(false);

      const result = await service.isRateLimited(testUser.id, testProject.id);
      expect(result).toBe(false);
    });
  });

  describe('incrementRequestCount', () => {
    it('should increment request count successfully', async () => {
      await service.incrementRequestCount(testUser.id, testProject.id);
      expect(mockRateLimiter.incrementRequestCount).toHaveBeenCalledWith(testUser.id, testProject.id);
    });
  });

  describe('blockUser', () => {
    it('should block user successfully', async () => {
      await service.blockUser(testUser.id, testProject.id);
      expect(mockRateLimiter.blockUser).toHaveBeenCalledWith(testUser.id, testProject.id);
    });
  });

  describe('resetLimits', () => {
    it('should reset limits successfully', async () => {
      await service.resetLimits(testUser.id, testProject.id);
      expect(mockRateLimiter.resetLimits).toHaveBeenCalledWith(testUser.id, testProject.id);
    });
  });
});
import { Pool } from 'pg';
import { OrganizationService } from '../../services/project/organizationService';
import { OrganizationStatus, MemberRole, MemberStatus } from '../../types/project';
import { DatabaseError, NotFoundError } from '../../utils/errors';

// Mock the database pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('OrganizationService', () => {
  let pool: Pool;
  let service: OrganizationService;
  let mockClient: any;

  beforeEach(() => {
    pool = new Pool();
    service = new OrganizationService(pool);
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrganization', () => {
    const testOrg = {
      id: '123',
      name: 'Test Org',
      slug: 'test-org',
      billingEmail: 'test@example.com',
      status: OrganizationStatus.Active,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    it('should create an organization and add owner', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [testOrg] }) // org creation
        .mockResolvedValueOnce({ rows: [{ id: '456' }] }); // member creation

      const result = await service.createOrganization(
        'Test Org',
        'test@example.com',
        'user123'
      );

      expect(mockClient.query).toHaveBeenCalledTimes(4); // BEGIN, create org, add member, COMMIT
      expect(result).toEqual(testOrg);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // org creation fails

      await expect(service.createOrganization(
        'Test Org',
        'test@example.com',
        'user123'
      )).rejects.toThrow(DatabaseError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getOrganization', () => {
    it('should return organization if found', async () => {
      const testOrg = {
        id: '123',
        name: 'Test Org',
        status: OrganizationStatus.Active
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [testOrg]
      });

      const result = await service.getOrganization('123');
      expect(result).toEqual(testOrg);
    });

    it('should throw NotFoundError if organization not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      await expect(service.getOrganization('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateOrganization', () => {
    it('should update organization fields', async () => {
      const updates = {
        name: 'Updated Org',
        metadata: { key: 'value' }
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...updates, id: '123' }]
      });

      const result = await service.updateOrganization('123', updates);
      expect(result.name).toBe(updates.name);
      expect(result.metadata).toEqual(updates.metadata);
    });

    it('should throw NotFoundError if organization not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      await expect(service.updateOrganization('123', { name: 'Updated' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('addMember', () => {
    it('should add member to organization', async () => {
      const testMember = {
        id: '456',
        organizationId: '123',
        userId: 'user123',
        role: MemberRole.Admin,
        status: MemberStatus.Invited
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [testMember]
      });

      const result = await service.addMember(
        '123',
        'user123',
        MemberRole.Admin,
        'inviter123'
      );

      expect(result).toEqual(testMember);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const testMember = {
        id: '456',
        role: MemberRole.Admin
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [testMember]
      });

      const result = await service.updateMemberRole(
        '123',
        'user123',
        MemberRole.Admin
      );

      expect(result.role).toBe(MemberRole.Admin);
    });

    it('should throw NotFoundError if member not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      await expect(service.updateMemberRole('123', 'user123', MemberRole.Admin))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getMembers', () => {
    it('should return organization members', async () => {
      const testMembers = [
        { id: '456', role: MemberRole.Owner },
        { id: '789', role: MemberRole.Member }
      ];

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: testMembers
      });

      const result = await service.getMembers('123');
      expect(result).toEqual(testMembers);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept member invitation', async () => {
      const testMember = {
        id: '456',
        status: MemberStatus.Active,
        joinedAt: new Date()
      };

      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: [testMember]
      });

      const result = await service.acceptInvitation('123', 'user123');
      expect(result.status).toBe(MemberStatus.Active);
      expect(result.joinedAt).toBeDefined();
    });

    it('should throw NotFoundError if invitation not found', async () => {
      (pool.query as jest.Mock).mockResolvedValueOnce({
        rows: []
      });

      await expect(service.acceptInvitation('123', 'user123'))
        .rejects.toThrow(NotFoundError);
    });
  });
}); 
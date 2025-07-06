import { Pool } from 'pg';
import { OrganizationService } from '../../services/project/organizationService';
import { OrganizationStatus, MemberRole, MemberStatus, SubscriptionTier, SubscriptionStatus } from '../../types/project';
import { NotFoundError } from '../../utils/errors';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let mockClient: any;
  let mockPool: any;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      query: jest.fn()
    };

    service = new OrganizationService(mockPool);
  });

  const testOrg = {
    id: '123',
    name: 'Test Org',
    slug: 'test-org',
    billingEmail: 'test@example.com',
    status: OrganizationStatus.Active,
    subscriptionTier: SubscriptionTier.Free,
    subscriptionStatus: SubscriptionStatus.Active,
    subscriptionExpiresAt: null,
    createdAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {}
  };

  const dbOrg = {
    id: '123',
    name: 'Test Org',
    slug: 'test-org',
    billing_email: 'test@example.com',
    status: OrganizationStatus.Active,
    subscription_tier: SubscriptionTier.Free,
    subscription_status: SubscriptionStatus.Active,
    subscription_expires_at: null,
    created_at: new Date('2025-07-06T01:29:26.221Z'),
    updated_at: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {}
  };

  const testMember = {
    id: '456',
    organizationId: '123',
    userId: 'user123',
    role: MemberRole.Owner,
    status: MemberStatus.Active,
    invitedBy: 'user123',
    invitedAt: new Date('2025-07-06T01:29:26.221Z'),
    joinedAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z')
  };

  const dbMember = {
    id: '456',
    organization_id: '123',
    user_id: 'user123',
    role: MemberRole.Owner,
    status: MemberStatus.Active,
    invited_by: 'user123',
    invited_at: new Date('2025-07-06T01:29:26.221Z'),
    joined_at: new Date('2025-07-06T01:29:26.221Z'),
    updated_at: new Date('2025-07-06T01:29:26.221Z')
  };

  describe('createOrganization', () => {
    it('should create an organization and add owner', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [dbOrg] }) // Create org
        .mockResolvedValueOnce({ rows: [dbMember] }) // Add member
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createOrganization(
        'Test Org',
        'test@example.com',
        'user123'
      );

      expect(mockClient.query).toHaveBeenCalledTimes(4);
      expect(result).toEqual(testOrg);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getOrganization', () => {
    it('should return organization if found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [dbOrg] });

      const result = await service.getOrganization('123');
      expect(result).toEqual(testOrg);
    });

    it('should throw NotFoundError if organization not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getOrganization('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateOrganization', () => {
    it('should update organization fields', async () => {
      const updatedDbOrg = {
        ...dbOrg,
        name: 'Updated Org',
        metadata: { key: 'value' }
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [updatedDbOrg]
      });

      const result = await service.updateOrganization('123', {
        name: 'Updated Org',
        metadata: { key: 'value' }
      });

      expect(result).toEqual({
        ...testOrg,
        name: 'Updated Org',
        metadata: { key: 'value' }
      });
    });

    it('should throw NotFoundError if organization not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateOrganization('123', { name: 'Updated' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('addMember', () => {
    it('should add member to organization', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [dbMember] });

      const result = await service.addMember(
        '123',
        'user123',
        MemberRole.Member,
        'admin123'
      );

      expect(result).toEqual(testMember);
    });
  });

  describe('updateMemberRole', () => {
    it('should update member role', async () => {
      const updatedDbMember = {
        ...dbMember,
        role: MemberRole.Admin
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [updatedDbMember]
      });

      const result = await service.updateMemberRole(
        '123',
        'user123',
        MemberRole.Admin
      );

      expect(result).toEqual({
        ...testMember,
        role: MemberRole.Admin
      });
    });

    it('should throw NotFoundError if member not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateMemberRole('123', 'user123', MemberRole.Admin))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getMembers', () => {
    it('should return organization members', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          dbMember,
          { ...dbMember, id: '789', role: MemberRole.Member }
        ]
      });

      const result = await service.getMembers('123');
      expect(result).toEqual([
        testMember,
        { ...testMember, id: '789', role: MemberRole.Member }
      ]);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept member invitation', async () => {
      const acceptedDbMember = {
        ...dbMember,
        status: MemberStatus.Active,
        joined_at: new Date('2025-07-06T01:29:26.221Z')
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [acceptedDbMember]
      });

      const result = await service.acceptInvitation('123', 'user123');
      expect(result).toEqual({
        ...testMember,
        status: MemberStatus.Active,
        joinedAt: new Date('2025-07-06T01:29:26.221Z')
      });
    });

    it('should throw NotFoundError if invitation not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.acceptInvitation('123', 'user123'))
        .rejects.toThrow(NotFoundError);
    });
  });
});
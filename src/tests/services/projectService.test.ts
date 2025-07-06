import { Pool } from 'pg';
import { ProjectService } from '../../services/project/projectService';
import { ProjectType, ProjectStatus } from '../../types/project';
import { NotFoundError, ValidationError } from '../../utils/errors';

describe('ProjectService', () => {
  let service: ProjectService;
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

    service = new ProjectService(mockPool);
  });

  const testProject = {
    id: '123',
    name: 'Test Project',
    slug: 'test-project',
    organizationId: 'org123',
    type: ProjectType.Production,
    status: ProjectStatus.Active,
    createdAt: new Date('2025-07-06T01:29:26.221Z'),
    updatedAt: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {}
  };

  const dbProject = {
    id: '123',
    name: 'Test Project',
    slug: 'test-project',
    organization_id: 'org123',
    type: ProjectType.Production,
    status: ProjectStatus.Active,
    created_at: new Date('2025-07-06T01:29:26.221Z'),
    updated_at: new Date('2025-07-06T01:29:26.221Z'),
    metadata: {}
  };

  describe('createProject', () => {
    it('should create a project', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [dbProject] }) // Insert project
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createProject(
        'Test Project',
        'org123',
        ProjectType.Production
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual(testProject);
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getProject', () => {
    it('should return project if found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [dbProject] });

      const result = await service.getProject('123');
      expect(result).toEqual(testProject);
    });

    it('should throw NotFoundError if project not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getProject('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const updatedDbProject = {
        ...dbProject,
        name: 'Updated Project',
        metadata: { key: 'value' }
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [updatedDbProject]
      });

      const result = await service.updateProject('123', {
        name: 'Updated Project',
        metadata: { key: 'value' }
      });

      expect(result).toEqual({
        ...testProject,
        name: 'Updated Project',
        metadata: { key: 'value' }
      });
    });

    it('should throw NotFoundError if project not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.updateProject('123', { name: 'Updated' }))
        .rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError if no valid updates', async () => {
      await expect(service.updateProject('123', {}))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('getProjectsByOrganization', () => {
    it('should return organization projects', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          dbProject,
          { ...dbProject, id: '456', name: 'Test Project 2' }
        ]
      });

      const result = await service.getProjectsByOrganization('org123');
      expect(result).toEqual([
        testProject,
        { ...testProject, id: '456', name: 'Test Project 2' }
      ]);
    });
  });

  describe('updateProjectSettings', () => {
    const settings = {
      webhookUrl: 'https://example.com/webhook',
      allowedOrigins: ['example.com'],
      customSettings: { key: 'value' }
    };

    const dbSettings = {
      project_id: '123',
      webhook_url: 'https://example.com/webhook',
      allowed_origins: ['example.com'],
      custom_settings: { key: 'value' },
      updated_at: new Date('2025-07-06T01:29:26.221Z')
    };

    it('should update project settings', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [dbSettings] }) // Insert/Update settings
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.updateProjectSettings('123', settings);
      expect(result).toEqual({
        projectId: '123',
        webhookUrl: settings.webhookUrl,
        allowedOrigins: settings.allowedOrigins,
        customSettings: settings.customSettings,
        updatedAt: new Date('2025-07-06T01:29:26.221Z')
      });
    });

    it('should throw NotFoundError if project not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Insert/Update settings

      await expect(service.updateProjectSettings('123', {}))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectSettings', () => {
    const dbSettings = {
      project_id: '123',
      webhook_url: 'https://example.com/webhook',
      allowed_origins: ['example.com'],
      custom_settings: { key: 'value' },
      updated_at: new Date('2025-07-06T01:29:26.221Z')
    };

    it('should return project settings', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [dbSettings] });

      const result = await service.getProjectSettings('123');
      expect(result.webhookUrl).toBe(dbSettings.webhook_url);
      expect(result.allowedOrigins).toEqual(dbSettings.allowed_origins);
      expect(result.customSettings).toEqual(dbSettings.custom_settings);
    });

    it('should throw NotFoundError if settings not found', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.getProjectSettings('123'))
        .rejects.toThrow(NotFoundError);
    });
  });
}); 
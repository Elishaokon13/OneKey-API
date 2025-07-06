import { Pool } from 'pg';
import { ProjectService } from '../../services/project/projectService';
import { ProjectStatus, ProjectType } from '../../types/project';
import { DatabaseError, NotFoundError } from '../../utils/errors';

// Mock the database pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe('ProjectService', () => {
  let pool: Pool;
  let service: ProjectService;
  let mockClient: any;

  beforeEach(() => {
    pool = new Pool();
    service = new ProjectService(pool);
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const testProject = {
      id: '123',
      name: 'Test Project',
      slug: 'test-project',
      organizationId: 'org123',
      type: ProjectType.Production,
      status: ProjectStatus.Active,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    it('should create a project', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [testProject] }) // project creation
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.createProject(
        'Test Project',
        'org123',
        ProjectType.Production,
        {}
      );

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(result).toEqual(testProject);
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // project creation fails

      await expect(service.createProject(
        'Test Project',
        'org123',
        ProjectType.Production,
        {}
      )).rejects.toThrow(DatabaseError);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('getProject', () => {
    it('should return project if found', async () => {
      const testProject = {
        id: '123',
        name: 'Test Project',
        status: ProjectStatus.Active
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [testProject]
      });

      const result = await service.getProject('123');
      expect(result).toEqual(testProject);
    });

    it('should throw NotFoundError if project not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.getProject('123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateProject', () => {
    it('should update project fields', async () => {
      const updates = {
        name: 'Updated Project',
        metadata: { key: 'value' }
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [{ ...updates, id: '123' }]
      });

      const result = await service.updateProject('123', updates);
      expect(result.name).toBe(updates.name);
      expect(result.metadata).toEqual(updates.metadata);
    });

    it('should throw NotFoundError if project not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.updateProject('123', { name: 'Updated' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectsByOrganization', () => {
    it('should return organization projects', async () => {
      const testProjects = [
        { id: '123', name: 'Project 1', type: ProjectType.Production },
        { id: '456', name: 'Project 2', type: ProjectType.Sandbox }
      ];

      mockClient.query.mockResolvedValueOnce({
        rows: testProjects
      });

      const result = await service.getProjectsByOrganization('org123');
      expect(result).toEqual(testProjects);
    });
  });

  describe('updateProjectSettings', () => {
    it('should update project settings', async () => {
      const settings = {
        webhookUrl: 'https://example.com/webhook',
        allowedOrigins: ['example.com'],
        customSettings: { key: 'value' }
      };

      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [{ ...settings, projectId: '123' }] }) // settings update
        .mockResolvedValueOnce({}); // COMMIT

      const result = await service.updateProjectSettings('123', settings);
      expect(result.webhookUrl).toBe(settings.webhookUrl);
      expect(result.allowedOrigins).toEqual(settings.allowedOrigins);
      expect(result.customSettings).toEqual(settings.customSettings);
    });

    it('should throw NotFoundError if project not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({}) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // settings update fails

      await expect(service.updateProjectSettings('123', {}))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('getProjectSettings', () => {
    it('should return project settings', async () => {
      const settings = {
        projectId: '123',
        webhookUrl: 'https://example.com/webhook',
        allowedOrigins: ['example.com']
      };

      mockClient.query.mockResolvedValueOnce({
        rows: [settings]
      });

      const result = await service.getProjectSettings('123');
      expect(result).toEqual(settings);
    });

    it('should throw NotFoundError if settings not found', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: []
      });

      await expect(service.getProjectSettings('123'))
        .rejects.toThrow(NotFoundError);
    });
  });
}); 
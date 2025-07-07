import { ViewManager } from '@/services/access/viewManager';
import { knex } from '@/config/database';

describe('ViewManager', () => {
  let viewManager: ViewManager;

  beforeAll(() => {
    viewManager = ViewManager.getInstance();
  });

  beforeEach(async () => {
    // Clear any mocks
    jest.clearAllMocks();
  });

  describe('refreshViews', () => {
    it('should refresh all permission views', async () => {
      const mockRaw = jest.spyOn(knex, 'raw').mockResolvedValue({});

      await viewManager.refreshViews();

      expect(mockRaw).toHaveBeenCalledWith('SELECT refresh_permission_views()');
    });

    it('should handle refresh errors', async () => {
      const mockError = new Error('Refresh failed');
      jest.spyOn(knex, 'raw').mockRejectedValue(mockError);

      await expect(viewManager.refreshViews()).rejects.toThrow(mockError);
    });
  });

  describe('refreshView', () => {
    it('should refresh a specific view', async () => {
      const mockRaw = jest.spyOn(knex, 'raw').mockResolvedValue({});
      const viewName = 'mv_user_roles';

      await viewManager.refreshView(viewName);

      expect(mockRaw).toHaveBeenCalledWith(
        `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`
      );
    });

    it('should handle view refresh errors', async () => {
      const mockError = new Error('View refresh failed');
      jest.spyOn(knex, 'raw').mockRejectedValue(mockError);

      await expect(viewManager.refreshView('mv_user_roles')).rejects.toThrow(mockError);
    });
  });

  describe('getViewLastUpdated', () => {
    it('should get last update time for a view', async () => {
      const mockDate = new Date();
      jest.spyOn(knex, 'raw').mockResolvedValue({
        rows: [{ last_updated: mockDate }]
      });

      const result = await viewManager.getViewLastUpdated('mv_user_roles');

      expect(result).toBe(mockDate);
    });

    it('should return null for non-existent view', async () => {
      jest.spyOn(knex, 'raw').mockResolvedValue({ rows: [] });

      const result = await viewManager.getViewLastUpdated('non_existent_view');

      expect(result).toBeNull();
    });
  });

  describe('getViewStats', () => {
    it('should get stats for all permission views', async () => {
      const mockStats = {
        row_count: 100,
        size: '1 MB',
        last_updated: new Date()
      };

      jest.spyOn(knex, 'raw').mockResolvedValue({
        rows: [mockStats]
      });

      const stats = await viewManager.getViewStats();

      expect(Object.keys(stats)).toHaveLength(5); // 5 materialized views
      expect(stats.mv_user_roles).toEqual(mockStats);
    });

    it('should handle errors for individual views', async () => {
      jest.spyOn(knex, 'raw').mockRejectedValue(new Error('Stats failed'));

      const stats = await viewManager.getViewStats();

      expect(stats.mv_user_roles).toEqual({ error: 'Failed to get stats' });
    });
  });

  describe('checkViewsNeedRefresh', () => {
    it('should return true if any view is outdated', async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      jest.spyOn(knex, 'raw').mockResolvedValue({
        rows: [{ last_updated: oldDate }]
      });

      const needsRefresh = await viewManager.checkViewsNeedRefresh();

      expect(needsRefresh).toBe(true);
    });

    it('should return false if all views are up to date', async () => {
      const recentDate = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      jest.spyOn(knex, 'raw').mockResolvedValue({
        rows: [{ last_updated: recentDate }]
      });

      const needsRefresh = await viewManager.checkViewsNeedRefresh();

      expect(needsRefresh).toBe(false);
    });

    it('should return true if any view has no last_updated time', async () => {
      jest.spyOn(knex, 'raw').mockResolvedValue({
        rows: [{ last_updated: null }]
      });

      const needsRefresh = await viewManager.checkViewsNeedRefresh();

      expect(needsRefresh).toBe(true);
    });
  });
}); 
import { knex } from '@/config/database';
import { logger } from '@/utils/logger';

export class ViewManager {
  private static instance: ViewManager;

  private constructor() {}

  public static getInstance(): ViewManager {
    if (!ViewManager.instance) {
      ViewManager.instance = new ViewManager();
    }
    return ViewManager.instance;
  }

  /**
   * Refresh all permission-related materialized views
   */
  public async refreshViews(): Promise<void> {
    try {
      await knex.raw('SELECT refresh_permission_views()');
      logger.info('Successfully refreshed permission views');
    } catch (error) {
      logger.error('Failed to refresh permission views', { error });
      throw error;
    }
  }

  /**
   * Refresh a specific materialized view
   */
  public async refreshView(viewName: string): Promise<void> {
    try {
      await knex.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
      logger.info('Successfully refreshed view', { viewName });
    } catch (error) {
      logger.error('Failed to refresh view', { error, viewName });
      throw error;
    }
  }

  /**
   * Get the last update time for a materialized view
   */
  public async getViewLastUpdated(viewName: string): Promise<Date | null> {
    try {
      const result = await knex.raw(`
        SELECT reltuples::bigint AS row_count, 
               pg_size_pretty(pg_relation_size(oid)) AS size,
               pg_stat_get_last_autoanalyze_time(oid) AS last_updated
        FROM pg_class
        WHERE relname = ?
      `, [viewName]);

      return result.rows[0]?.last_updated || null;
    } catch (error) {
      logger.error('Failed to get view last updated time', { error, viewName });
      throw error;
    }
  }

  /**
   * Get statistics for all permission-related materialized views
   */
  public async getViewStats(): Promise<Record<string, any>> {
    const views = [
      'mv_user_roles',
      'mv_user_permissions',
      'mv_project_rbac_config',
      'mv_project_abac_config',
      'mv_user_attributes'
    ];

    const stats: Record<string, any> = {};

    for (const view of views) {
      try {
        const result = await knex.raw(`
          SELECT reltuples::bigint AS row_count, 
                 pg_size_pretty(pg_relation_size(oid)) AS size,
                 pg_stat_get_last_autoanalyze_time(oid) AS last_updated
          FROM pg_class
          WHERE relname = ?
        `, [view]);

        stats[view] = result.rows[0];
      } catch (error) {
        logger.error('Failed to get view stats', { error, view });
        stats[view] = { error: 'Failed to get stats' };
      }
    }

    return stats;
  }

  /**
   * Check if views need refresh based on update frequency
   */
  public async checkViewsNeedRefresh(): Promise<boolean> {
    try {
      const stats = await this.getViewStats();
      const now = new Date();
      const refreshThreshold = 1000 * 60 * 60; // 1 hour

      for (const view of Object.values(stats)) {
        if (!view.last_updated) return true;
        
        const lastUpdated = new Date(view.last_updated);
        if (now.getTime() - lastUpdated.getTime() > refreshThreshold) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to check if views need refresh', { error });
      return true; // Refresh on error to be safe
    }
  }
} 
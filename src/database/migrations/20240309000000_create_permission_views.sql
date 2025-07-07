-- OneKey KYC API Migration
-- Migration: 20240309000000_create_permission_views.sql
-- Description: Create materialized views for common permission queries

-- Create materialized view for user roles with inheritance
CREATE MATERIALIZED VIEW mv_user_roles AS
WITH RECURSIVE role_hierarchy AS (
  -- Base roles
  SELECT 
    ur.user_id,
    ur.project_id,
    ur.role,
    ur.active,
    ARRAY[ur.role] as role_path
  FROM user_roles ur
  WHERE ur.active = true

  UNION

  -- Inherited roles
  SELECT 
    rh.user_id,
    rh.project_id,
    pr.child_role as role,
    rh.active,
    rh.role_path || pr.child_role
  FROM role_hierarchy rh
  JOIN project_role_hierarchy pr ON pr.parent_role = rh.role
  WHERE NOT pr.child_role = ANY(rh.role_path) -- Prevent cycles
)
SELECT DISTINCT
  user_id,
  project_id,
  role,
  active
FROM role_hierarchy;

-- Create indices for the user roles materialized view
CREATE UNIQUE INDEX idx_mv_user_roles_user_project_role 
ON mv_user_roles(user_id, project_id, role);
CREATE INDEX idx_mv_user_roles_user_id ON mv_user_roles(user_id);
CREATE INDEX idx_mv_user_roles_project_id ON mv_user_roles(project_id);

-- Create materialized view for user permissions
CREATE MATERIALIZED VIEW mv_user_permissions AS
SELECT 
  ur.user_id,
  ur.project_id,
  ur.role,
  rp.permission
FROM mv_user_roles ur
JOIN role_permissions rp ON rp.role = ur.role
WHERE ur.active = true;

-- Create indices for the user permissions materialized view
CREATE UNIQUE INDEX idx_mv_user_permissions_user_project_perm 
ON mv_user_permissions(user_id, project_id, permission);
CREATE INDEX idx_mv_user_permissions_user_id ON mv_user_permissions(user_id);
CREATE INDEX idx_mv_user_permissions_project_id ON mv_user_permissions(project_id);

-- Create materialized view for project RBAC configurations
CREATE MATERIALIZED VIEW mv_project_rbac_config AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  ps.value as rbac_config,
  ps.updated_at as config_updated_at
FROM projects p
JOIN project_settings ps ON ps.project_id = p.id
WHERE ps.key = 'rbac_config'
  AND ps.active = true;

-- Create indices for the project RBAC config materialized view
CREATE UNIQUE INDEX idx_mv_project_rbac_config_id 
ON mv_project_rbac_config(project_id);

-- Create materialized view for project ABAC configurations
CREATE MATERIALIZED VIEW mv_project_abac_config AS
SELECT 
  p.id as project_id,
  p.name as project_name,
  ps.value as abac_config,
  ps.updated_at as config_updated_at
FROM projects p
JOIN project_settings ps ON ps.project_id = p.id
WHERE ps.key = 'abac_config'
  AND ps.active = true;

-- Create indices for the project ABAC config materialized view
CREATE UNIQUE INDEX idx_mv_project_abac_config_id 
ON mv_project_abac_config(project_id);

-- Create materialized view for user attributes
CREATE MATERIALIZED VIEW mv_user_attributes AS
SELECT 
  u.id as user_id,
  u.project_id,
  u.metadata->>'roles' as roles,
  u.metadata->>'attributes' as attributes,
  u.updated_at as attributes_updated_at
FROM users u
WHERE u.active = true;

-- Create indices for the user attributes materialized view
CREATE UNIQUE INDEX idx_mv_user_attributes_id 
ON mv_user_attributes(user_id, project_id);
CREATE INDEX idx_mv_user_attributes_project_id 
ON mv_user_attributes(project_id);

-- Create function to refresh all permission views
CREATE OR REPLACE FUNCTION refresh_permission_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_roles;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_permissions;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_rbac_config;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_abac_config;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_attributes;
END;
$$ LANGUAGE plpgsql;

-- Create trigger function to refresh views when relevant tables are updated
CREATE OR REPLACE FUNCTION refresh_permission_views_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM refresh_permission_views();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for relevant tables
CREATE TRIGGER refresh_permission_views_user_roles
AFTER INSERT OR UPDATE OR DELETE ON user_roles
FOR EACH STATEMENT EXECUTE FUNCTION refresh_permission_views_trigger();

CREATE TRIGGER refresh_permission_views_project_settings
AFTER INSERT OR UPDATE OR DELETE ON project_settings
FOR EACH STATEMENT EXECUTE FUNCTION refresh_permission_views_trigger();

CREATE TRIGGER refresh_permission_views_users
AFTER INSERT OR UPDATE OR DELETE ON users
FOR EACH STATEMENT EXECUTE FUNCTION refresh_permission_views_trigger();

-- Update migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('20240309000000', NOW())
ON CONFLICT (version) DO NOTHING; 
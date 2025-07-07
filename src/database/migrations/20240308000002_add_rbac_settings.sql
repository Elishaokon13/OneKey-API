-- Add RBAC configuration to project_settings
INSERT INTO project_settings (project_id, key, value)
SELECT 
    id as project_id,
    'rbac_config' as key,
    '{
        "enabled": true,
        "roles": {
            "admin": {
                "description": "Administrator role",
                "permissions": ["all:*"]
            },
            "developer": {
                "description": "Developer role",
                "permissions": ["api:write", "api:read"],
                "parent": "admin"
            },
            "user": {
                "description": "Regular user role",
                "permissions": ["api:read"],
                "parent": "developer"
            }
        }
    }'::jsonb as value
FROM projects
WHERE NOT EXISTS (
    SELECT 1 FROM project_settings 
    WHERE project_settings.project_id = projects.id 
    AND project_settings.key = 'rbac_config'
)
LIMIT 1;

-- Add ABAC configuration to project_settings
INSERT INTO project_settings (project_id, key, value)
SELECT 
    id as project_id,
    'abac_config' as key,
    '{
        "enabled": true,
        "rules": [
            {
                "name": "Production Access",
                "description": "Controls access to production environment",
                "conditions": {
                    "environment": "production",
                    "requiredRoles": ["admin"]
                }
            },
            {
                "name": "Development Access",
                "description": "Controls access to development environment",
                "conditions": {
                    "environment": "development",
                    "requiredRoles": ["developer", "admin"]
                }
            }
        ]
    }'::jsonb as value
FROM projects
WHERE NOT EXISTS (
    SELECT 1 FROM project_settings 
    WHERE project_settings.project_id = projects.id 
    AND project_settings.key = 'abac_config'
)
LIMIT 1; 
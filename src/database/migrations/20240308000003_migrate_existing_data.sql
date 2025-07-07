-- Update users metadata to include roles
UPDATE users 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{roles}',
    '["user"]'::jsonb,
    true
)
WHERE metadata->>'roles' IS NULL;

-- Update organizations metadata to include default settings
UPDATE organizations 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{settings}',
    jsonb_build_object(
        'default_user_role', 'user',
        'require_email_verification', true,
        'allow_wallet_login', true
    ),
    true
)
WHERE metadata->>'settings' IS NULL;

-- Update projects metadata to include features
UPDATE projects 
SET metadata = jsonb_set(
    COALESCE(metadata, '{}'::jsonb),
    '{features}',
    '["rbac", "abac", "analytics"]'::jsonb,
    true
)
WHERE metadata->>'features' IS NULL;

-- Add default RBAC settings for projects that don't have them
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
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM project_settings ps 
    WHERE ps.project_id = p.id 
    AND ps.key = 'rbac_config'
);

-- Add default ABAC settings for projects that don't have them
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
FROM projects p
WHERE NOT EXISTS (
    SELECT 1 FROM project_settings ps 
    WHERE ps.project_id = p.id 
    AND ps.key = 'abac_config'
);

-- Update audit_logs to include standardized action format
UPDATE audit_logs
SET action = CASE 
    WHEN action NOT LIKE '%:%' THEN 
        CASE 
            WHEN action LIKE '%create%' THEN 'resource:create'
            WHEN action LIKE '%update%' THEN 'resource:update'
            WHEN action LIKE '%delete%' THEN 'resource:delete'
            WHEN action LIKE '%read%' THEN 'resource:read'
            ELSE 'resource:' || action
        END
    ELSE action
END
WHERE action IS NOT NULL; 
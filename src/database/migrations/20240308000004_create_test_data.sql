-- Create test organization
INSERT INTO organizations (name, slug, billing_email, status, subscription_tier, subscription_status, metadata)
VALUES (
    'Test Organization',
    'test-org',
    'test@example.com',
    'active',
    'free',
    'active',
    '{
        "settings": {
            "default_user_role": "user",
            "require_email_verification": true,
            "allow_wallet_login": true
        }
    }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Create test project
INSERT INTO projects (
    organization_id,
    name,
    slug,
    environment,
    status,
    metadata
)
SELECT
    id as organization_id,
    'Test Project',
    'test-project',
    'development',
    'active',
    '{
        "features": ["rbac", "abac", "analytics"]
    }'::jsonb
FROM organizations
WHERE slug = 'test-org'
ON CONFLICT (organization_id, slug, environment) DO NOTHING;

-- Add RBAC configuration
INSERT INTO project_settings (project_id, key, value)
SELECT 
    p.id as project_id,
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
JOIN organizations o ON p.organization_id = o.id
WHERE o.slug = 'test-org' AND p.slug = 'test-project'
ON CONFLICT (project_id, key) DO NOTHING;

-- Add ABAC configuration
INSERT INTO project_settings (project_id, key, value)
SELECT 
    p.id as project_id,
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
JOIN organizations o ON p.organization_id = o.id
WHERE o.slug = 'test-org' AND p.slug = 'test-project'
ON CONFLICT (project_id, key) DO NOTHING;

-- Create test user
INSERT INTO users (
    email,
    project_id,
    metadata
)
SELECT
    'admin@example.com',
    p.id as project_id,
    '{
        "roles": ["admin"],
        "attributes": {
            "department": "Engineering",
            "level": "Senior"
        }
    }'::jsonb as metadata
FROM projects p
JOIN organizations o ON p.organization_id = o.id
WHERE o.slug = 'test-org' AND p.slug = 'test-project'
ON CONFLICT (email) DO NOTHING; 
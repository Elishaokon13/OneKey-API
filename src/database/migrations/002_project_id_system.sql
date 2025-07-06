-- OneKey KYC API Project ID System Migration
-- Migration: 002_project_id_system.sql
-- Description: Add multi-tenant support with organizations and projects

-- Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
    billing_email VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, suspended, deleted
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free', -- free, pro, enterprise
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'active',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Create indices for organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_subscription_tier ON organizations(subscription_tier);

-- Organization members table
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- owner, admin, member
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, invited, removed
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- Create indices for organization members
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_organization_members_role ON organization_members(role);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL, -- URL-friendly identifier
    environment VARCHAR(50) NOT NULL DEFAULT 'development', -- development, staging, production
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- active, archived, deleted
    kyc_providers JSONB DEFAULT '[]', -- Enabled KYC providers for this project
    webhook_url TEXT, -- Default webhook URL for this project
    webhook_secret VARCHAR(255), -- Secret for webhook signature verification
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(organization_id, slug, environment)
);

-- Create indices for projects
CREATE INDEX idx_projects_organization_id ON projects(organization_id);
CREATE INDEX idx_projects_environment ON projects(environment);
CREATE INDEX idx_projects_status ON projects(status);

-- Project settings table
CREATE TABLE project_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, key)
);

-- Create index for project settings
CREATE INDEX idx_project_settings_project_id ON project_settings(project_id);

-- Project API keys table (replacing global api_keys table)
CREATE TABLE project_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'server', -- server, client, admin
    permissions JSONB DEFAULT '[]',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    rate_limit_override JSONB,
    metadata JSONB DEFAULT '{}'
);

-- Create indices for project API keys
CREATE INDEX idx_project_api_keys_project_id ON project_api_keys(project_id);
CREATE INDEX idx_project_api_keys_key_hash ON project_api_keys(key_hash);
CREATE INDEX idx_project_api_keys_type ON project_api_keys(type);

-- Project usage stats table
CREATE TABLE project_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    kyc_verifications_count INTEGER DEFAULT 0,
    attestations_created_count INTEGER DEFAULT 0,
    storage_bytes_used BIGINT DEFAULT 0,
    api_requests_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, date)
);

-- Create index for project usage stats
CREATE INDEX idx_project_usage_stats_project_id_date ON project_usage_stats(project_id, date);

-- Add project_id to existing tables
ALTER TABLE users ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE kyc_sessions ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE attestations ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE storage_references ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE user_consents ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE audit_logs ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- Create indices for new project_id columns
CREATE INDEX idx_users_project_id ON users(project_id);
CREATE INDEX idx_kyc_sessions_project_id ON kyc_sessions(project_id);
CREATE INDEX idx_attestations_project_id ON attestations(project_id);
CREATE INDEX idx_storage_references_project_id ON storage_references(project_id);
CREATE INDEX idx_user_consents_project_id ON user_consents(project_id);
CREATE INDEX idx_audit_logs_project_id ON audit_logs(project_id);

-- Add updated_at triggers to new tables
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_settings_updated_at BEFORE UPDATE ON project_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_project_usage_stats_updated_at BEFORE UPDATE ON project_usage_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create enum types for better data integrity
CREATE TYPE organization_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'expired');
CREATE TYPE member_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE member_status AS ENUM ('active', 'invited', 'removed');
CREATE TYPE project_environment AS ENUM ('development', 'staging', 'production');
CREATE TYPE project_status AS ENUM ('active', 'archived', 'deleted');
CREATE TYPE api_key_type AS ENUM ('server', 'client', 'admin');

-- Insert migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('002', NOW())
ON CONFLICT (version) DO NOTHING; 
-- OneKey KYC API Initial Schema Migration
-- Migration: 001_initial_schema.sql
-- Description: Create core tables for user management, KYC tracking, attestations, and consent management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table for basic user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Hashed password for email/password auth
    wallet_address VARCHAR(255) UNIQUE, -- Privy wallet address
    passkey_id VARCHAR(255), -- Alternative authentication
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}' -- Additional user metadata
);

-- Create index on email and wallet_address for fast lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet_address ON users(wallet_address);
CREATE INDEX idx_users_created_at ON users(created_at);

-- KYC sessions table for tracking verification attempts
CREATE TABLE kyc_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) UNIQUE NOT NULL, -- External KYC provider session ID
    provider VARCHAR(50) NOT NULL, -- smile_identity, onfido, trulioo
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    country_code VARCHAR(3), -- ISO country code
    document_type VARCHAR(50), -- passport, drivers_license, national_id
    verification_result JSONB, -- Provider-specific verification results (without PII)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}' -- Additional session metadata
);

-- Create indices for KYC sessions
CREATE INDEX idx_kyc_sessions_user_id ON kyc_sessions(user_id);
CREATE INDEX idx_kyc_sessions_status ON kyc_sessions(status);
CREATE INDEX idx_kyc_sessions_provider ON kyc_sessions(provider);
CREATE INDEX idx_kyc_sessions_created_at ON kyc_sessions(created_at);

-- EAS Attestations table for tracking blockchain attestations
CREATE TABLE attestations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL,
    attestation_id VARCHAR(255) UNIQUE NOT NULL, -- EAS attestation ID
    schema_id VARCHAR(255) NOT NULL, -- EAS schema ID
    recipient VARCHAR(255) NOT NULL, -- Wallet address or hash
    attester VARCHAR(255) NOT NULL, -- Our attester address
    data_hash VARCHAR(255) NOT NULL, -- Hash of encrypted data
    storage_cid VARCHAR(255), -- Filecoin/IPFS CID
    storage_url TEXT, -- Storage URL reference
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    selective_attributes JSONB DEFAULT '[]', -- ZKP attributes available
    metadata JSONB DEFAULT '{}' -- Additional attestation metadata
);

-- Create indices for attestations
CREATE INDEX idx_attestations_user_id ON attestations(user_id);
CREATE INDEX idx_attestations_attestation_id ON attestations(attestation_id);
CREATE INDEX idx_attestations_recipient ON attestations(recipient);
CREATE INDEX idx_attestations_data_hash ON attestations(data_hash);
CREATE INDEX idx_attestations_revoked ON attestations(revoked);

-- Storage references table for tracking encrypted data locations
CREATE TABLE storage_references (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kyc_session_id UUID REFERENCES kyc_sessions(id) ON DELETE SET NULL,
    storage_type VARCHAR(50) NOT NULL, -- filecoin, arweave, ipfs
    storage_id VARCHAR(255) NOT NULL, -- CID or storage identifier
    storage_url TEXT, -- Full storage URL
    data_hash VARCHAR(255) NOT NULL, -- Hash for integrity verification
    encryption_key_hash VARCHAR(255), -- Hash of encryption key (for verification)
    access_conditions JSONB, -- Lit Protocol access conditions
    file_size BIGINT, -- File size in bytes
    content_type VARCHAR(255), -- MIME type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Additional storage metadata
);

-- Create indices for storage references
CREATE INDEX idx_storage_references_user_id ON storage_references(user_id);
CREATE INDEX idx_storage_references_storage_type ON storage_references(storage_type);
CREATE INDEX idx_storage_references_data_hash ON storage_references(data_hash);
CREATE INDEX idx_storage_references_created_at ON storage_references(created_at);

-- User consents table for tracking data sharing permissions
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requesting_platform VARCHAR(255) NOT NULL, -- Platform requesting access
    granted_permissions JSONB NOT NULL, -- Specific permissions granted
    attestation_id UUID REFERENCES attestations(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT false,
    granted_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    access_count INTEGER DEFAULT 0, -- Track how many times data was accessed
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}' -- Additional consent metadata
);

-- Create indices for user consents
CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_platform ON user_consents(requesting_platform);
CREATE INDEX idx_user_consents_granted ON user_consents(granted);
CREATE INDEX idx_user_consents_expires_at ON user_consents(expires_at);

-- API keys table for server-to-server authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hashed API key
    name VARCHAR(255) NOT NULL, -- Human-readable name
    permissions JSONB DEFAULT '[]', -- Array of permissions
    created_by VARCHAR(255), -- Who created this key
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    rate_limit_override JSONB, -- Custom rate limits for this key
    metadata JSONB DEFAULT '{}' -- Additional key metadata
);

-- Create indices for API keys
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- Audit log table for tracking all important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- kyc_initiated, attestation_created, consent_granted, etc.
    resource_type VARCHAR(50), -- user, kyc_session, attestation, consent
    resource_id UUID, -- ID of the affected resource
    old_values JSONB, -- Previous state (if applicable)
    new_values JSONB, -- New state
    ip_address VARCHAR(45), -- IPv4 or IPv6 address
    user_agent TEXT, -- Browser/client user agent
    request_id UUID, -- Link to request ID for tracing
    allowed BOOLEAN DEFAULT false, -- Whether the action was allowed
    details JSONB DEFAULT '{}', -- Additional audit details
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Additional audit metadata
);

-- Create indices for audit logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kyc_sessions_updated_at BEFORE UPDATE ON kyc_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_consents_updated_at BEFORE UPDATE ON user_consents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create enum types for better data integrity
CREATE TYPE kyc_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'expired');
CREATE TYPE kyc_provider AS ENUM ('smile_identity', 'onfido', 'trulioo');
CREATE TYPE storage_type AS ENUM ('filecoin', 'arweave', 'ipfs');

-- Alter tables to use enum types (optional for stricter validation)
-- ALTER TABLE kyc_sessions ALTER COLUMN status TYPE kyc_status USING status::kyc_status;
-- ALTER TABLE kyc_sessions ALTER COLUMN provider TYPE kyc_provider USING provider::kyc_provider;
-- ALTER TABLE storage_references ALTER COLUMN storage_type TYPE storage_type USING storage_type::storage_type;

-- Create schema migrations table to track applied migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(50) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('001', NOW())
ON CONFLICT (version) DO NOTHING; 
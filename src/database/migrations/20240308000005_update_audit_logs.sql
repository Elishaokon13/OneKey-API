-- OneKey KYC API Migration
-- Migration: 20240308000005_update_audit_logs.sql
-- Description: Add missing columns to audit_logs table

-- Add allowed and details columns to audit_logs
ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}';

-- Update migration record
INSERT INTO schema_migrations (version, applied_at) VALUES ('20240308000005', NOW())
ON CONFLICT (version) DO NOTHING; 
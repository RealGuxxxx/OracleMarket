-- Migration: Add service_api_keys table for API Key management
-- Created: 2025-01-XX
-- Description: Allows service providers to create API keys for programmatic service updates

-- Service API Keys table
CREATE TABLE IF NOT EXISTS service_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id TEXT NOT NULL,
    provider_address TEXT NOT NULL,
    api_key_hash TEXT NOT NULL,  -- bcrypt hash of the API key
    name TEXT,  -- Optional: friendly name for the key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,  -- NULL means never expires
    last_used_at TIMESTAMP WITH TIME ZONE,
    active BOOLEAN DEFAULT true,
    permissions TEXT[] DEFAULT ARRAY['update_config', 'update_docs'],  -- Permissions array
    
    -- Foreign key to services table (optional, for referential integrity)
    CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_api_keys_service_id ON service_api_keys(service_id);
CREATE INDEX IF NOT EXISTS idx_service_api_keys_provider ON service_api_keys(provider_address);
CREATE INDEX IF NOT EXISTS idx_service_api_keys_active ON service_api_keys(active);

-- Index for API key hash lookups (for authentication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_api_keys_hash ON service_api_keys(api_key_hash) WHERE active = true;

-- Enable Row Level Security
ALTER TABLE service_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Service providers can manage their own API keys
CREATE POLICY "Service providers can view their own API keys"
    ON service_api_keys
    FOR SELECT
    USING (provider_address = current_setting('app.current_user_address', true));

CREATE POLICY "Service providers can create API keys for their services"
    ON service_api_keys
    FOR INSERT
    WITH CHECK (
        provider_address = current_setting('app.current_user_address', true) AND
        service_id IN (
            SELECT id FROM services WHERE provider = current_setting('app.current_user_address', true)
        )
    );

CREATE POLICY "Service providers can update their own API keys"
    ON service_api_keys
    FOR UPDATE
    USING (provider_address = current_setting('app.current_user_address', true));

CREATE POLICY "Service providers can delete their own API keys"
    ON service_api_keys
    FOR DELETE
    USING (provider_address = current_setting('app.current_user_address', true));

-- Comments for documentation
COMMENT ON TABLE service_api_keys IS 'API keys for service providers to programmatically update their services';
COMMENT ON COLUMN service_api_keys.api_key_hash IS 'bcrypt hash of the API key (never store plain text)';
COMMENT ON COLUMN service_api_keys.permissions IS 'Array of permissions: update_config, update_docs, etc.';
COMMENT ON COLUMN service_api_keys.expires_at IS 'NULL means the key never expires';


-- Migration: Rename encrypted_config_id to config_id
-- Created: 2025-01-24
-- Description: Renames encrypted_config_id column to config_id to match the updated contract schema
--              This migration is safe and preserves existing data

-- Step 1: Add config_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'services' 
        AND column_name = 'config_id'
    ) THEN
        -- Add the new column
        ALTER TABLE services 
        ADD COLUMN config_id VARCHAR(255);
        
        -- Copy data from encrypted_config_id to config_id if encrypted_config_id exists
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'services' 
            AND column_name = 'encrypted_config_id'
        ) THEN
            UPDATE services 
            SET config_id = encrypted_config_id 
            WHERE encrypted_config_id IS NOT NULL;
        END IF;
        
        RAISE NOTICE 'Added config_id column and migrated data from encrypted_config_id';
    ELSE
        RAISE NOTICE 'config_id column already exists';
    END IF;
END $$;

-- Step 2: Create index on config_id for faster lookups (optional)
CREATE INDEX IF NOT EXISTS idx_services_config_id ON services(config_id) WHERE config_id IS NOT NULL;


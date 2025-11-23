-- Migration: Create oracle_queries table for storing OracleQuery objects
-- Created: 2025-01-XX
-- Description: Stores resolved OracleQuery objects from the chain for faster querying

CREATE TABLE IF NOT EXISTS oracle_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    object_id TEXT NOT NULL UNIQUE,  -- OracleQuery object ID on chain
    query_id TEXT NOT NULL,  -- Query ID (e.g., "price_btc_usd")
    query_type TEXT,  -- Query type (e.g., "price")
    query_params TEXT,  -- Query parameters (JSON string)
    provider TEXT NOT NULL,  -- Provider address
    service_id TEXT,  -- Service ID (can be null if not linked)
    resolved BOOLEAN DEFAULT false,  -- Whether the query is resolved
    result TEXT,  -- Query result (JSON string)
    result_hash TEXT,  -- Hash of the result
    evidence_url TEXT,  -- Walrus evidence URL
    created_at BIGINT,  -- Timestamp from chain
    updated_at BIGINT,  -- Last update timestamp from chain
    transaction_digest TEXT,  -- Transaction digest that created/updated this query
    
    -- Indexes
    CONSTRAINT fk_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_oracle_queries_object_id ON oracle_queries(object_id);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_query_id ON oracle_queries(query_id);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_provider ON oracle_queries(provider);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_service_id ON oracle_queries(service_id);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_resolved ON oracle_queries(resolved);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_updated_at ON oracle_queries(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE oracle_queries ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Anyone can read, but only system can write
CREATE POLICY "Anyone can view oracle queries"
    ON oracle_queries
    FOR SELECT
    USING (true);

CREATE POLICY "System can insert oracle queries"
    ON oracle_queries
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "System can update oracle queries"
    ON oracle_queries
    FOR UPDATE
    USING (true);

-- Comments
COMMENT ON TABLE oracle_queries IS 'Stores OracleQuery objects from the chain for faster querying and indexing';
COMMENT ON COLUMN oracle_queries.object_id IS 'Unique OracleQuery object ID on Sui chain';
COMMENT ON COLUMN oracle_queries.query_id IS 'Query identifier (e.g., "price_btc_usd_001")';
COMMENT ON COLUMN oracle_queries.evidence_url IS 'Walrus evidence URL for data verification';


-- Enable Required PostgreSQL Extensions
-- Created: 2025-12-09

-- Enable UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create uuid_generate_v7() function for time-ordered UUIDs
-- This is critical for AGOG standards (NOT gen_random_uuid())
CREATE OR REPLACE FUNCTION uuid_generate_v7()
RETURNS UUID
AS $$
DECLARE
  unix_ts_ms BIGINT;
  uuid_bytes BYTEA;
BEGIN
  unix_ts_ms = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  uuid_bytes = SET_BYTE(SET_BYTE('\x00000000000000000000000000000000'::BYTEA,
0, (unix_ts_ms >> 40)::INT),
                        1, ((unix_ts_ms >> 32) & 255)::INT);
  uuid_bytes = SET_BYTE(SET_BYTE(uuid_bytes, 2, ((unix_ts_ms >> 24) & 255)::INT),
                        3, ((unix_ts_ms >> 16) & 255)::INT);
  uuid_bytes = SET_BYTE(SET_BYTE(uuid_bytes, 4, ((unix_ts_ms >> 8) & 255)::INT),
                        5, (unix_ts_ms & 255)::INT);
  uuid_bytes = SET_BYTE(uuid_bytes, 6, (get_byte(gen_random_bytes(1), 0) & 15) | 112);
  uuid_bytes = SET_BYTE(uuid_bytes, 7, get_byte(gen_random_bytes(1), 0));
  uuid_bytes = SET_BYTE(uuid_bytes, 8, (get_byte(gen_random_bytes(1), 0) & 63) | 128);
  uuid_bytes = SET_BYTE(SET_BYTE(SET_BYTE(SET_BYTE(SET_BYTE(SET_BYTE(SET_BYTE(
    uuid_bytes,
    9, get_byte(gen_random_bytes(1), 0)),
    10, get_byte(gen_random_bytes(1), 0)),
    11, get_byte(gen_random_bytes(1), 0)),
    12, get_byte(gen_random_bytes(1), 0)),
    13, get_byte(gen_random_bytes(1), 0)),
    14, get_byte(gen_random_bytes(1), 0)),
    15, get_byte(gen_random_bytes(1), 0));
  RETURN encode(uuid_bytes, 'hex')::UUID;
END
$$ LANGUAGE PLPGSQL VOLATILE;

COMMENT ON FUNCTION uuid_generate_v7() IS 'Generate UUIDv7 (time-ordered) - AGOG standard for all primary keys';

-- Enable pgvector for Layer 4 Memory System
CREATE EXTENSION IF NOT EXISTS vector;

COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation functions';
COMMENT ON EXTENSION "pgcrypto" IS 'Cryptographic functions';
COMMENT ON EXTENSION "vector" IS 'Vector similarity search for AI embeddings';

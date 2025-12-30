-- Fix uuid_generate_v7() BYTEA to UUID casting error
-- Created: 2024-12-24
-- Issue: Cannot cast type bytea to uuid directly
-- Solution: Use encode(bytea, 'hex')::UUID instead

-- Replace the uuid_generate_v7() function with corrected casting
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

COMMENT ON FUNCTION uuid_generate_v7() IS 'Generate UUIDv7 (time-ordered) - AGOG standard for all primary keys (fixed BYTEA casting)';

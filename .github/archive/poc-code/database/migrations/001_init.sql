-- Example migration: Add a new column to tenants

ALTER TABLE tenants ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
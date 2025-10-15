-- Migration: Change timestamp column from TIMESTAMP(3) to BIGINT
-- This allows storing relative milliseconds since session start

USE research_platform;

-- Modify the timestamp column to BIGINT for storing relative milliseconds
ALTER TABLE interaction_logs
MODIFY COLUMN timestamp BIGINT NOT NULL COMMENT 'Milliseconds relative to session start';

-- Verify the change
DESCRIBE interaction_logs;

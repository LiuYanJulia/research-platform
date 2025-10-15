-- Migration script to add timestamp columns to submissions table
USE research_platform;

-- Add new columns to submissions table
ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS session_start_timestamp BIGINT AFTER char_count,
ADD COLUMN IF NOT EXISTS recording_start_timestamp BIGINT AFTER session_start_timestamp;

-- Verify columns were added
DESCRIBE submissions;

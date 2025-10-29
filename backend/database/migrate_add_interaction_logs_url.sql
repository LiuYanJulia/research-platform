-- Migration: Add interaction_logs_file_url column to submissions table
-- Date: 2025-10-23
-- Purpose: Store reference to interaction logs CSV file

USE research_platform;

-- Add interaction_logs_file_url column
ALTER TABLE submissions
ADD COLUMN interaction_logs_file_url VARCHAR(255) AFTER chat_history_file_url;

-- Verify the change
DESCRIBE submissions;

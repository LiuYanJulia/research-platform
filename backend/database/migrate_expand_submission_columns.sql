-- Migration: Replace TEXT columns with file URL columns
-- Date: 2025-10-22
-- Purpose: Store transcript and chat history in separate JSON files instead of in database columns

USE research_platform;

-- Drop the TEXT columns and add file URL columns
ALTER TABLE submissions
DROP COLUMN transcript_content,
DROP COLUMN chat_history,
ADD COLUMN transcript_file_url VARCHAR(255) AFTER final_writing,
ADD COLUMN chat_history_file_url VARCHAR(255) AFTER transcript_file_url;

-- Verify the change
DESCRIBE submissions;

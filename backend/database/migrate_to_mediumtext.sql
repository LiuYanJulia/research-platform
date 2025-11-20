-- Migration script to change final_writing column from TEXT to MEDIUMTEXT
-- This allows storing up to ~16 MB of text instead of ~64 KB

USE research_platform;

-- Alter the submissions table to change final_writing from TEXT to MEDIUMTEXT
ALTER TABLE submissions MODIFY COLUMN final_writing MEDIUMTEXT;

-- Verify the change
DESCRIBE submissions;

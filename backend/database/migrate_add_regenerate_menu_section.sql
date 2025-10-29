-- Migration: Add 'regenerate-menu' to target_section ENUM
-- Date: 2025-01-XX
-- Purpose: Support logging for regenerate menu button interactions

USE research_platform;

-- Alter the interaction_logs table to add 'regenerate-menu' to the target_section ENUM
ALTER TABLE interaction_logs
MODIFY COLUMN target_section ENUM('prompting', 'transcript', 'response', 'writing', 'regenerate-menu');

-- Verify the change
DESCRIBE interaction_logs;

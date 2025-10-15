-- Migration: Add 'selection' event type to interaction_logs table
-- This enables logging of text selection and cursor position events

USE research_platform;

-- Modify the event_type ENUM to include 'selection'
ALTER TABLE interaction_logs
MODIFY COLUMN event_type ENUM('mouse', 'keyboard', 'ui', 'api', 'session', 'selection') NOT NULL;

-- Verify the change
SHOW COLUMNS FROM interaction_logs WHERE Field = 'event_type';

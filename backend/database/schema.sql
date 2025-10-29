-- Research Platform Database Schema

USE research_platform;

-- Sessions table to track user sessions
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'draft') DEFAULT 'active'
);

-- Transcripts table to store voice transcriptions
CREATE TABLE IF NOT EXISTS transcripts (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    content TEXT,
    audio_file_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Chat messages table to store LLM conversations
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    message_id VARCHAR(36),
    role ENUM('user', 'assistant') NOT NULL,
    content TEXT NOT NULL,
    model_slug VARCHAR(50),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Final writings table to store user's final submissions
CREATE TABLE IF NOT EXISTS final_writings (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    content TEXT,
    word_count INT DEFAULT 0,
    char_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    submitted_at TIMESTAMP NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Submissions table for comprehensive final submissions
CREATE TABLE IF NOT EXISTS submissions (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36),
    final_writing TEXT,
    transcript_file_url VARCHAR(255),
    chat_history_file_url VARCHAR(255),
    audio_file_url VARCHAR(255),
    word_count INT DEFAULT 0,
    char_count INT DEFAULT 0,
    session_start_timestamp BIGINT,
    recording_start_timestamp BIGINT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_transcripts_session ON transcripts(session_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);
CREATE INDEX idx_final_writings_session ON final_writings(session_id);
CREATE INDEX idx_submissions_session ON submissions(session_id);

-- Show created tables
SHOW TABLES;
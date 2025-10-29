import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mysql from 'mysql2/promise';

// Import route handlers
import transcriptRoutes from './routes/transcript';
import chatRoutes from './routes/chat';
import loggingRoutes from './routes/logging';
import sessionRoutes from './routes/session';
import submissionRoutes from './routes/submission';
import writingRoutes from './routes/writing';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (audio and chat history)
app.use('/uploads', express.static('uploads'));

// Database connection
let db: mysql.Connection;

async function initDatabase() {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'research_platform'
    });

    console.log('Connected to MySQL database');

    // Create tables if they don't exist
    await createTables();
  } catch (error) {
    console.error('Database connection failed:', error);
    console.log('Running without database connection for demo purposes');
    db = null as any;
  }
}

async function createTables() {
  if (!db) return;

  try {
    // Sessions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        participant_id VARCHAR(255) NOT NULL,
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP NULL,
        status ENUM('active', 'completed', 'abandoned') DEFAULT 'active',
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Transcripts table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_session_timestamp (session_id, timestamp)
      )
    `);

    // Messages table (for LLM conversations)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        role ENUM('user', 'assistant') NOT NULL,
        content TEXT NOT NULL,
        model_slug VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_session_timestamp (session_id, timestamp)
      )
    `);

    // Interaction logs table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS interaction_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        event_type ENUM('mouse', 'keyboard', 'ui', 'api', 'session', 'selection') NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_element VARCHAR(255),
        target_section ENUM('prompting', 'transcript', 'response', 'writing', 'regenerate-menu'),
        coordinates JSON,
        text_content TEXT,
        metadata JSON,
        timestamp BIGINT NOT NULL COMMENT 'Milliseconds relative to session start',
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_session_timestamp (session_id, timestamp),
        INDEX idx_event_type (event_type),
        INDEX idx_action (action)
      )
    `);

    // Final submissions table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL UNIQUE,
        content TEXT NOT NULL,
        word_count INT DEFAULT 0,
        char_count INT DEFAULT 0,
        submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    // Writing drafts table (for auto-save)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS writing_drafts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        session_id VARCHAR(36) NOT NULL,
        content TEXT,
        word_count INT DEFAULT 0,
        char_count INT DEFAULT 0,
        last_saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
        INDEX idx_session (session_id)
      )
    `);

    console.log('Database tables created successfully');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Make database connection available to routes
app.use((req, res, next) => {
  (req as any).db = db;
  (req as any).io = io;
  next();
});

// Routes
app.use('/api/transcript', transcriptRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/logging', loggingRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/writing', writingRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join session room for real-time updates
  socket.on('join-session', (sessionId: string) => {
    socket.join(sessionId);
    console.log(`Client ${socket.id} joined session: ${sessionId}`);
  });

  // Handle real-time transcript updates
  socket.on('transcript-update', (data) => {
    // Broadcast to all clients in the same session
    socket.to(data.sessionId).emit('transcript-updated', data);
  });

  // Handle realtime transcription events
  socket.on('realtime-transcript', (data) => {
    // Broadcast real-time transcription to session
    socket.to(data.sessionId).emit('realtime-transcript-update', data);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  await initDatabase();

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`);
  });
}

startServer().catch(console.error);
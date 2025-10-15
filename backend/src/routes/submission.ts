import express from 'express';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/audio');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sessionId = req.body.sessionId || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `${sessionId}_${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

// Upload audio file
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const fileUrl = `/uploads/audio/${req.file.filename}`;
    console.log(`Audio file uploaded: ${fileUrl}`);

    res.json({
      success: true,
      fileUrl,
      filename: req.file.filename
    });
  } catch (error) {
    console.error('Error uploading audio:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload audio file'
    });
  }
});

// Submit final work
router.post('/submit', async (req, res) => {
  const db: mysql.Connection = (req as any).db;

  try {
    const {
      sessionId,
      finalWriting,
      wordCount,
      charCount,
      audioFileUrl,
      transcriptWithTimestamps,
      chatHistoryWithTimestamps,
      sessionStartTimestamp,
      recordingStartTimestamp,
      submittedAt
    } = req.body;

    // Convert ISO timestamp to MySQL datetime format
    const mysqlTimestamp = new Date(submittedAt).toISOString().slice(0, 19).replace('T', ' ');
    const transcriptJson = JSON.stringify(transcriptWithTimestamps || []);
    const chatHistoryJson = JSON.stringify(chatHistoryWithTimestamps || []);

    if (!db) {
      console.log('Demo mode: Submission received but not saved to database');
      console.log('Chat history with timestamps:', chatHistoryWithTimestamps);
      return res.json({
        success: true,
        message: 'Submission received (demo mode)',
        data: {
          sessionId,
          wordCount,
          charCount,
          submittedAt
        }
      });
    }

    // Check if submission already exists for this session
    const [existingSubmissions] = await db.execute(
      'SELECT id FROM submissions WHERE session_id = ?',
      [sessionId]
    );

    if ((existingSubmissions as any[]).length > 0) {
      // Update existing submission
      await db.execute(
        `UPDATE submissions
         SET final_writing = ?, transcript_content = ?, chat_history = ?, audio_file_url = ?, word_count = ?, char_count = ?, session_start_timestamp = ?, recording_start_timestamp = ?, submitted_at = ?
         WHERE session_id = ?`,
        [finalWriting, transcriptJson, chatHistoryJson, audioFileUrl, wordCount, charCount, sessionStartTimestamp, recordingStartTimestamp, mysqlTimestamp, sessionId]
      );
    } else {
      // Generate unique ID for submission
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert new submission
      await db.execute(
        `INSERT INTO submissions (id, session_id, final_writing, transcript_content, chat_history, audio_file_url, word_count, char_count, session_start_timestamp, recording_start_timestamp, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [submissionId, sessionId, finalWriting, transcriptJson, chatHistoryJson, audioFileUrl, wordCount, charCount, sessionStartTimestamp, recordingStartTimestamp, mysqlTimestamp]
      );
    }

    // Update session status to completed
    await db.execute(
      `UPDATE sessions SET status = 'completed' WHERE id = ?`,
      [sessionId]
    );

    console.log(`Submission saved for session: ${sessionId}`);

    res.json({
      success: true,
      message: 'Submission saved successfully',
      data: {
        sessionId,
        wordCount,
        charCount,
        submittedAt
      }
    });
  } catch (error) {
    console.error('Error saving submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save submission',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get submission by session ID
router.get('/:sessionId', async (req, res) => {
  const db: mysql.Connection = (req as any).db;
  const { sessionId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not available (demo mode)' });
    }

    const [submissions] = await db.execute(
      'SELECT * FROM submissions WHERE session_id = ?',
      [sessionId]
    );

    if ((submissions as any[]).length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ submission: (submissions as any[])[0] });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

export default router;

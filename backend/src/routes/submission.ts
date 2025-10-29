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
    // Generate temporary filename first, will rename after getting sessionId from body
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `temp_${timestamp}${ext}`);
  }
});

const upload = multer({ storage });

// Upload audio file
router.post('/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const sessionId = req.body.sessionId || 'unknown';
    const ext = path.extname(req.file.originalname);
    const newFilename = `audio_${sessionId}${ext}`;

    // Rename the file from temp name to proper name with sessionId
    const oldPath = req.file.path;
    const newPath = path.join(path.dirname(oldPath), newFilename);

    fs.renameSync(oldPath, newPath);

    const fileUrl = `/uploads/audio/${newFilename}`;
    console.log(`Audio file uploaded and renamed: ${fileUrl}`);

    res.json({
      success: true,
      fileUrl,
      filename: newFilename
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

    // Save transcript to a separate JSON file
    const transcriptDir = path.join(__dirname, '../../uploads/transcripts');
    if (!fs.existsSync(transcriptDir)) {
      fs.mkdirSync(transcriptDir, { recursive: true });
    }

    const transcriptFilename = `transcript_${sessionId}.json`;
    const transcriptPath = path.join(transcriptDir, transcriptFilename);
    const transcriptFileUrl = `/uploads/transcripts/${transcriptFilename}`;

    // Write transcript to file
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptWithTimestamps || [], null, 2));
    console.log(`Transcript saved to file: ${transcriptPath}`);

    // Save chat history to a separate JSON file
    const chatHistoryDir = path.join(__dirname, '../../uploads/chat_history');
    if (!fs.existsSync(chatHistoryDir)) {
      fs.mkdirSync(chatHistoryDir, { recursive: true });
    }

    const chatHistoryFilename = `chat_history_${sessionId}.json`;
    const chatHistoryPath = path.join(chatHistoryDir, chatHistoryFilename);
    const chatHistoryFileUrl = `/uploads/chat_history/${chatHistoryFilename}`;

    // Write chat history to file
    fs.writeFileSync(chatHistoryPath, JSON.stringify(chatHistoryWithTimestamps || [], null, 2));
    console.log(`Chat history saved to file: ${chatHistoryPath}`);

    // Generate and save interaction logs CSV
    let interactionLogsFileUrl = null;
    if (db) {
      try {
        // Get all logs for this session
        const [rows] = await db.execute(
          'SELECT * FROM interaction_logs WHERE session_id = ? ORDER BY timestamp ASC',
          [sessionId]
        );

        const logs = rows as any[];

        // Create CSV header
        const headers = [
          'id',
          'session_id',
          'event_type',
          'action',
          'target_element',
          'target_section',
          'coordinates',
          'text_content',
          'metadata',
          'timestamp'
        ];

        // Helper function to escape CSV fields
        const escapeCsvField = (value: any): string => {
          if (value === null || value === undefined) {
            return '';
          }
          // If value is an object (JSON), stringify it first
          let stringValue: string;
          if (typeof value === 'object') {
            stringValue = JSON.stringify(value);
          } else {
            stringValue = String(value);
          }
          // If the field contains comma, newline, or double quote, wrap it in quotes
          if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        };

        // Create CSV rows
        const csvRows = [
          headers.join(','), // Header row
          ...logs.map(log => {
            return [
              log.id,
              log.session_id,
              log.event_type,
              log.action,
              escapeCsvField(log.target_element),
              log.target_section,
              escapeCsvField(log.coordinates),
              escapeCsvField(log.text_content),
              escapeCsvField(log.metadata),
              log.timestamp
            ].join(',');
          })
        ];

        const csvContent = csvRows.join('\n');

        // Save to uploads/interaction_logs directory
        const logsDir = path.join(__dirname, '../../uploads/interaction_logs');
        if (!fs.existsSync(logsDir)) {
          fs.mkdirSync(logsDir, { recursive: true });
        }

        const logsFilename = `interaction_logs_${sessionId}.csv`;
        const logsPath = path.join(logsDir, logsFilename);
        interactionLogsFileUrl = `/uploads/interaction_logs/${logsFilename}`;

        // Write CSV to file
        fs.writeFileSync(logsPath, csvContent);
        console.log(`Interaction logs saved to file: ${logsPath}`);
      } catch (logError) {
        console.error('Error saving interaction logs:', logError);
        // Don't fail the submission if interaction logs fail
      }
    }

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
          submittedAt,
          transcriptFileUrl,
          chatHistoryFileUrl
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
         SET final_writing = ?, transcript_file_url = ?, chat_history_file_url = ?, interaction_logs_file_url = ?, audio_file_url = ?, word_count = ?, char_count = ?, session_start_timestamp = ?, recording_start_timestamp = ?, submitted_at = ?
         WHERE session_id = ?`,
        [finalWriting, transcriptFileUrl, chatHistoryFileUrl, interactionLogsFileUrl, audioFileUrl, wordCount, charCount, sessionStartTimestamp, recordingStartTimestamp, mysqlTimestamp, sessionId]
      );
    } else {
      // Generate unique ID for submission
      const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Insert new submission
      await db.execute(
        `INSERT INTO submissions (id, session_id, final_writing, transcript_file_url, chat_history_file_url, interaction_logs_file_url, audio_file_url, word_count, char_count, session_start_timestamp, recording_start_timestamp, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [submissionId, sessionId, finalWriting, transcriptFileUrl, chatHistoryFileUrl, interactionLogsFileUrl, audioFileUrl, wordCount, charCount, sessionStartTimestamp, recordingStartTimestamp, mysqlTimestamp]
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
        submittedAt,
        transcriptFileUrl,
        chatHistoryFileUrl,
        interactionLogsFileUrl
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

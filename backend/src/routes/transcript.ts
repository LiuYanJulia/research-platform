import express, { Request } from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

// Extend Request type to include file
interface MulterRequest extends Request {
  file?: Express.Multer.File;
  db?: any;
}

const router = express.Router();

// Lazy initialize OpenAI client to ensure .env is loaded
function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// Store active realtime connections
const realtimeConnections = new Map<string, WebSocket>();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased for longer recordings)
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/mp4',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type'));
    }
  }
});

// POST /api/transcript/session - Create OpenAI Realtime session for WebRTC
router.post('/session', async (req, res) => {
  try {
    console.log('Creating new OpenAI Realtime session...');

    // Get realtime model from environment or use default
    const realtimeModel = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';

    // Create session using OpenAI Realtime Sessions API
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: realtimeModel,
        voice: "alloy",
        modalities: ["text", "audio"],
        instructions: "You are a helpful assistant that provides live transcription. Focus on accurate speech-to-text conversion. Respond with transcribed text as you hear it.",
        input_audio_transcription: {
          model: "whisper-1"
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const session = await response.json();
    console.log('OpenAI Realtime session created:', session.id);

    res.json({
      session,
      model: realtimeModel,  // Pass model to frontend
      status: 'session_created',
      message: 'OpenAI Realtime session created for WebRTC'
    });

  } catch (error) {
    console.error('Failed to create realtime session:', error);
    res.status(500).json({
      error: 'Failed to create realtime session',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Legacy endpoints for backward compatibility - these will be replaced by WebRTC
router.post('/realtime-audio', (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecated. Use WebRTC connection directly to OpenAI.',
    message: 'Please create a session via /session endpoint and connect directly to OpenAI'
  });
});

router.post('/realtime-stop', (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecated. WebRTC sessions are managed client-side.',
    message: 'Sessions will automatically expire or can be closed client-side'
  });
});

// POST /api/transcript/transcribe-chunk - Transcribe audio using OpenAI Whisper (fallback)
router.post('/transcribe-chunk', upload.single('audio'), async (req: MulterRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create temporary file for OpenAI API
    const tempFilename = `temp_audio_chunk_${uuidv4()}.webm`;
    const tempPath = path.join(__dirname, '../../uploads', tempFilename);

    // Ensure uploads directory exists
    const uploadsDir = path.dirname(tempPath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write buffer to temporary file
    fs.writeFileSync(tempPath, req.file.buffer);

    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "en"
    });

    // Clean up temporary file
    fs.unlinkSync(tempPath);
    res.json({ text: transcription.text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Chunk transcription failed' });
  }
});


// POST /api/transcript/transcribe - Transcribe audio using OpenAI Whisper
router.post('/transcribe', upload.single('audio'), async (req: MulterRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Create temporary file for OpenAI API
    const tempFilename = `temp_audio_${uuidv4()}.webm`;
    const tempPath = path.join(__dirname, '../../uploads', tempFilename);

    // Ensure uploads directory exists
    const uploadsDir = path.dirname(tempPath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Write buffer to temporary file
    fs.writeFileSync(tempPath, req.file.buffer);

    // Transcribe with OpenAI Whisper
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: "whisper-1",
      language: "en", // Can be made configurable
      response_format: "text"
    });

    // Clean up temporary file
    fs.unlinkSync(tempPath);

    res.json({
      text: transcription,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: 'Transcription failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/transcript/save - Save transcript to database
router.post('/save', async (req: MulterRequest, res) => {
  try {
    const { content, timestamp } = req.body;
    const sessionId = 'current'; // For now, using default session
    const db = req.db;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Generate unique ID for transcript
    const transcriptId = uuidv4();

    // Insert or update transcript in database
    // First try to update existing transcript for this session
    const [updateResult] = await db.execute(
      `UPDATE transcripts SET content = ?, updated_at = NOW()
       WHERE session_id = ?`,
      [content, sessionId]
    );

    // If no rows were updated, insert new transcript
    if ((updateResult as any).affectedRows === 0) {
      await db.execute(
        `INSERT INTO transcripts (id, session_id, content, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())`,
        [transcriptId, sessionId, content]
      );
    }

    res.json({
      success: true,
      transcriptId: transcriptId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Save transcript error:', error);
    res.status(500).json({
      error: 'Failed to save transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/transcripts/current - Get current session transcript
router.get('/current', async (req: MulterRequest, res) => {
  try {
    const sessionId = 'current'; // Default session for now
    const db = req.db;

    const [rows] = await db.execute(
      'SELECT content, created_at FROM transcripts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
      [sessionId]
    );

    if ((rows as any[]).length === 0) {
      return res.json({ content: '', timestamp: null });
    }

    const transcript = (rows as any[])[0];
    res.json({
      content: transcript.content,
      timestamp: transcript.created_at,
    });

  } catch (error) {
    console.error('Get current transcript error:', error);
    res.status(500).json({
      error: 'Failed to retrieve current transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/transcripts/:sessionId - Get transcript for a specific session
router.get('/:sessionId', async (req: MulterRequest, res) => {
  try {
    const { sessionId } = req.params;
    const db = req.db;

    const [rows] = await db.execute(
      'SELECT content, created_at FROM transcripts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
      [sessionId]
    );

    if ((rows as any[]).length === 0) {
      return res.json({ content: '', timestamp: null });
    }

    const transcript = (rows as any[])[0];
    res.json({
      content: transcript.content,
      timestamp: transcript.created_at,
    });

  } catch (error) {
    console.error('Get transcript error:', error);
    res.status(500).json({
      error: 'Failed to retrieve transcript',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
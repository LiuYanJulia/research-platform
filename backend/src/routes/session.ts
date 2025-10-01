import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// POST /api/session/create - Create a new session
router.post('/create', async (req, res) => {
  try {
    const { participantId, metadata = {} } = req.body;
    const db = (req as any).db;

    if (!participantId) {
      return res.status(400).json({ error: 'Participant ID is required' });
    }

    const sessionId = uuidv4();

    await db.execute(
      'INSERT INTO sessions (id, participant_id, metadata) VALUES (?, ?, ?)',
      [sessionId, participantId, JSON.stringify(metadata)]
    );

    res.json({
      sessionId,
      participantId,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({
      error: 'Failed to create session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/session/:sessionId - Get session details
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const db = (req as any).db;

    const [rows] = await db.execute(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );

    if ((rows as any[]).length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = (rows as any[])[0];
    session.metadata = session.metadata ? JSON.parse(session.metadata) : {};

    res.json(session);

  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({
      error: 'Failed to retrieve session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/session/:sessionId/status - Update session status
router.put('/:sessionId/status', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;
    const db = (req as any).db;

    if (!['active', 'completed', 'abandoned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: active, completed, or abandoned' });
    }

    const endedAt = status !== 'active' ? new Date() : null;

    await db.execute(
      'UPDATE sessions SET status = ?, ended_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, endedAt, sessionId]
    );

    res.json({
      sessionId,
      status,
      endedAt: endedAt?.toISOString() || null,
      updatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({
      error: 'Failed to update session status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/session/:sessionId/submit - Submit final work for session
router.post('/:sessionId/submit', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { content } = req.body;
    const db = (req as any).db;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const wordCount = content.trim().split(/\s+/).length;
    const charCount = content.length;

    // Insert submission
    await db.execute(
      'INSERT INTO submissions (session_id, content, word_count, char_count) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE content = VALUES(content), word_count = VALUES(word_count), char_count = VALUES(char_count), submitted_at = CURRENT_TIMESTAMP',
      [sessionId, content, wordCount, charCount]
    );

    // Mark session as completed
    await db.execute(
      'UPDATE sessions SET status = ?, ended_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['completed', sessionId]
    );

    res.json({
      sessionId,
      submitted: true,
      wordCount,
      charCount,
      submittedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Submit session error:', error);
    res.status(500).json({
      error: 'Failed to submit session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/session/:sessionId/export - Export all session data
router.get('/:sessionId/export', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const db = (req as any).db;

    // Get session details
    const [sessionRows] = await db.execute(
      'SELECT * FROM sessions WHERE id = ?',
      [sessionId]
    );

    if ((sessionRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = (sessionRows as any[])[0];
    session.metadata = session.metadata ? JSON.parse(session.metadata) : {};

    // Get transcript
    const [transcriptRows] = await db.execute(
      'SELECT content, timestamp FROM transcripts WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1',
      [sessionId]
    );

    // Get messages
    const [messageRows] = await db.execute(
      'SELECT role, content, model_slug, timestamp FROM messages WHERE session_id = ? ORDER BY timestamp ASC',
      [sessionId]
    );

    // Get submission
    const [submissionRows] = await db.execute(
      'SELECT content, word_count, char_count, submitted_at FROM submissions WHERE session_id = ?',
      [sessionId]
    );

    // Get interaction stats
    const [statsRows] = await db.execute(
      `SELECT
         event_type,
         COUNT(*) as count,
         MIN(timestamp) as first_interaction,
         MAX(timestamp) as last_interaction
       FROM interaction_logs
       WHERE session_id = ?
       GROUP BY event_type`,
      [sessionId]
    );

    const exportData = {
      session,
      transcript: (transcriptRows as any[])[0] || null,
      messages: messageRows,
      submission: (submissionRows as any[])[0] || null,
      interactionStats: statsRows,
      exportedAt: new Date().toISOString(),
    };

    res.json(exportData);

  } catch (error) {
    console.error('Export session error:', error);
    res.status(500).json({
      error: 'Failed to export session data',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/session/participant/:participantId - Get all sessions for a participant
router.get('/participant/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const db = (req as any).db;

    const [rows] = await db.execute(
      'SELECT id, status, started_at, ended_at, metadata FROM sessions WHERE participant_id = ? ORDER BY started_at DESC',
      [participantId]
    );

    const sessions = (rows as any[]).map(session => ({
      ...session,
      metadata: session.metadata ? JSON.parse(session.metadata) : {},
    }));

    res.json({
      participantId,
      sessions,
      count: sessions.length,
    });

  } catch (error) {
    console.error('Get participant sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve participant sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
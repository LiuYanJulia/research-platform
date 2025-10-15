import express from 'express';
import mysql from 'mysql2/promise';

const router = express.Router();

// Auto-save writing content
router.post('/save', async (req, res) => {
  const db: mysql.Connection = (req as any).db;

  try {
    const {
      sessionId,
      content,
      wordCount,
      charCount,
      timestamp
    } = req.body;

    if (!db) {
      console.log('Demo mode: Auto-save received but not saved to database');
      return res.json({
        success: true,
        message: 'Auto-save received (demo mode)',
        timestamp
      });
    }

    // Check if writing record exists for this session
    const [existingWriting] = await db.execute(
      'SELECT id FROM writing_drafts WHERE session_id = ?',
      [sessionId]
    );

    const mysqlTimestamp = new Date(timestamp).toISOString().slice(0, 19).replace('T', ' ');

    if ((existingWriting as any[]).length > 0) {
      // Update existing draft
      await db.execute(
        `UPDATE writing_drafts
         SET content = ?, word_count = ?, char_count = ?, last_saved_at = ?
         WHERE session_id = ?`,
        [content, wordCount, charCount, mysqlTimestamp, sessionId]
      );
    } else {
      // Insert new draft
      await db.execute(
        `INSERT INTO writing_drafts (session_id, content, word_count, char_count, last_saved_at)
         VALUES (?, ?, ?, ?, ?)`,
        [sessionId, content, wordCount, charCount, mysqlTimestamp]
      );
    }

    res.json({
      success: true,
      message: 'Auto-save successful',
      timestamp
    });
  } catch (error) {
    console.error('Error auto-saving writing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to auto-save writing',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get writing draft by session ID
router.get('/:sessionId', async (req, res) => {
  const db: mysql.Connection = (req as any).db;
  const { sessionId } = req.params;

  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not available (demo mode)' });
    }

    const [drafts] = await db.execute(
      'SELECT * FROM writing_drafts WHERE session_id = ? ORDER BY last_saved_at DESC LIMIT 1',
      [sessionId]
    );

    if ((drafts as any[]).length === 0) {
      return res.json({ content: '', wordCount: 0, charCount: 0 });
    }

    res.json({ draft: (drafts as any[])[0] });
  } catch (error) {
    console.error('Error fetching writing draft:', error);
    res.status(500).json({ error: 'Failed to fetch writing draft' });
  }
});

export default router;

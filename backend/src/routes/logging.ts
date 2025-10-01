import express from 'express';

const router = express.Router();

// POST /api/logging/batch - Log multiple interactions at once
router.post('/batch', async (req, res) => {
  try {
    const { sessionId, logs } = req.body;
    const db = (req as any).db;

    if (!sessionId || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Session ID and logs array are required' });
    }

    // Prepare bulk insert
    const values = logs.map((log: any) => [
      sessionId,
      log.eventType || 'ui',
      log.action || 'unknown',
      log.target?.element || null,
      log.target?.section || null,
      log.target?.coordinates ? JSON.stringify(log.target.coordinates) : null,
      log.target?.text || null,
      log.metadata ? JSON.stringify(log.metadata) : null,
      log.timestamp || new Date().toISOString(),
    ]);

    if (values.length > 0) {
      const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = values.flat();

      await db.execute(
        `INSERT INTO interaction_logs
         (session_id, event_type, action, target_element, target_section, coordinates, text_content, metadata, timestamp)
         VALUES ${placeholders}`,
        flatValues
      );
    }

    res.json({
      success: true,
      count: values.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Batch logging error:', error);
    res.status(500).json({
      error: 'Failed to save logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/logging/single - Log a single interaction
router.post('/single', async (req, res) => {
  try {
    const { sessionId, eventType, action, target, metadata } = req.body;
    const db = (req as any).db;

    if (!sessionId || !eventType || !action) {
      return res.status(400).json({ error: 'Session ID, event type, and action are required' });
    }

    await db.execute(
      `INSERT INTO interaction_logs
       (session_id, event_type, action, target_element, target_section, coordinates, text_content, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        eventType,
        action,
        target?.element || null,
        target?.section || null,
        target?.coordinates ? JSON.stringify(target.coordinates) : null,
        target?.text || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Single logging error:', error);
    res.status(500).json({
      error: 'Failed to save log',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/logging/:sessionId - Get interaction logs for a session
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { eventType, action, limit = 1000, offset = 0 } = req.query;
    const db = (req as any).db;

    let query = 'SELECT * FROM interaction_logs WHERE session_id = ?';
    const params: any[] = [sessionId];

    if (eventType) {
      query += ' AND event_type = ?';
      params.push(eventType);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    query += ' ORDER BY timestamp ASC LIMIT ? OFFSET ?';
    params.push(parseInt(limit as string), parseInt(offset as string));

    const [rows] = await db.execute(query, params);

    // Parse JSON fields
    const logs = (rows as any[]).map(row => ({
      ...row,
      coordinates: row.coordinates ? JSON.parse(row.coordinates) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));

    res.json({
      logs,
      count: logs.length,
      sessionId,
    });

  } catch (error) {
    console.error('Get logs error:', error);
    res.status(500).json({
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/logging/:sessionId/stats - Get logging statistics for a session
router.get('/:sessionId/stats', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const db = (req as any).db;

    // Get counts by event type
    const [eventTypeStats] = await db.execute(
      'SELECT event_type, COUNT(*) as count FROM interaction_logs WHERE session_id = ? GROUP BY event_type',
      [sessionId]
    );

    // Get counts by action
    const [actionStats] = await db.execute(
      'SELECT action, COUNT(*) as count FROM interaction_logs WHERE session_id = ? GROUP BY action ORDER BY count DESC LIMIT 10',
      [sessionId]
    );

    // Get session duration and total interactions
    const [sessionStats] = await db.execute(
      `SELECT
         MIN(timestamp) as first_interaction,
         MAX(timestamp) as last_interaction,
         COUNT(*) as total_interactions
       FROM interaction_logs WHERE session_id = ?`,
      [sessionId]
    );

    res.json({
      sessionId,
      eventTypes: eventTypeStats,
      topActions: actionStats,
      sessionStats: (sessionStats as any[])[0],
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
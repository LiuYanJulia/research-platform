# Timestamp Schema Documentation

## Overview

The research platform uses **two different reference points** for timestamps to maintain accuracy across different data types.

## Reference Points

### 1. Session Start Timestamp
**Used by:**
- ✅ **Chat History** (`chat_messages` table)
- ✅ **Interaction Logs** (`interaction_logs` table)

**Reference:** `sessions.started_at` - The moment when the user clicks "I agree" and the session begins

**Calculation:**
```javascript
relative_timestamp = Date.now() - sessionStartTime
```

### 2. Recording Start Timestamp
**Used by:**
- ✅ **Transcript Content** (`transcripts` table)

**Reference:** `recording_start_timestamp` - The moment when audio recording actually starts (may be ~1 second after session start)

**Calculation:**
```javascript
relative_timestamp = Date.now() - recordingStartTime
```

## Why Two Reference Points?

**Session start** and **recording start** are different events:
- **Session starts**: When user agrees and UI loads (~time 0)
- **Recording starts**: ~1 second later after microphone initialization

This separation allows:
- Accurate timing of user interactions from the very beginning
- Precise audio-transcript synchronization
- No confusion between UI events and audio events

## Schema Design

### Interaction Logs Table

```sql
CREATE TABLE interaction_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,
  event_type ENUM('mouse', 'keyboard', 'ui', 'api', 'session', 'selection') NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_element VARCHAR(255),
  target_section ENUM('prompting', 'transcript', 'response', 'writing'),
  coordinates JSON,
  text_content TEXT,
  metadata JSON,
  timestamp BIGINT NOT NULL COMMENT 'Milliseconds relative to session start',
  -- Indexes
  INDEX idx_session_timestamp (session_id, timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_action (action)
);
```

**Key Points:**
- `timestamp` column: **BIGINT** (not TIMESTAMP)
- Stores: **Milliseconds since session start** (e.g., 742, 8206, 53405)
- Range: 0 to 2^63-1 (supports sessions up to ~292 million years)
- Precision: Millisecond-level timing

## Data Format by Type

### Reference: Session Start Timestamp

#### 1. Chat History (`chat_messages` table)
```json
{
  "role": "user",
  "content": "What is the capital of France?",
  "timestamp": 5420  // ms since SESSION START
}
```

#### 2. Interaction Logs (`interaction_logs` table)
```json
{
  "event_type": "mouse",
  "action": "cursor_move",
  "timestamp": 742  // ms since SESSION START
}
```

### Reference: Recording Start Timestamp

#### 3. Transcript Content (`transcripts` table)
```json
{
  "text": "Hello world",
  "timestamp": 12340  // ms since RECORDING START (different reference!)
}
```

**⚠️ Important:** Transcript timestamps use a different reference point (recording start) than chat/interaction logs (session start).

## Benefits

### 1. **Aligned Timeline for Chat & Interactions**
Chat and interaction events use the same reference and can be directly compared:
```sql
-- Get chat and interaction events in chronological order (same reference point)
SELECT 'chat' as type, content as data, timestamp
FROM chat_messages WHERE session_id = ?
UNION ALL
SELECT 'interaction' as type, action as data, timestamp
FROM interaction_logs WHERE session_id = ?
ORDER BY timestamp ASC;
```

**Note:** To include transcript data, you need to adjust timestamps:
```sql
-- Include transcript with timestamp adjustment
SELECT 'chat' as type, content as data, timestamp
FROM chat_messages WHERE session_id = ?
UNION ALL
SELECT 'interaction' as type, action as data, timestamp
FROM interaction_logs WHERE session_id = ?
UNION ALL
SELECT 'transcript' as type, content as data,
       (timestamp + recording_start_offset) as timestamp
FROM transcripts t
JOIN submissions s ON s.session_id = t.session_id
WHERE t.session_id = ?
ORDER BY timestamp ASC;
```
Where `recording_start_offset = recording_start_timestamp - session_start_timestamp`

### 2. **Precise Analysis**
Calculate exact time differences:
```sql
-- Time between user message and first interaction
SELECT
  (il.timestamp - cm.timestamp) as reaction_time_ms
FROM chat_messages cm
JOIN interaction_logs il ON il.session_id = cm.session_id
WHERE cm.role = 'user'
  AND il.timestamp > cm.timestamp
ORDER BY il.timestamp ASC
LIMIT 1;
```

### 3. **Compact Storage**
- BIGINT (8 bytes) vs TIMESTAMP(3) (7 bytes) - similar size
- No timezone issues
- No date parsing overhead

### 4. **Easy Conversion**
Convert relative to absolute time when needed:
```sql
SELECT
  il.*,
  FROM_UNIXTIME((s.started_at + il.timestamp/1000)) as absolute_time
FROM interaction_logs il
JOIN sessions s ON s.id = il.session_id
WHERE il.session_id = ?;
```

## Migration Steps

### Step 1: Run Migration SQL
```bash
mysql -u root -p research_platform < backend/database/migrate_timestamp_to_bigint.sql
```

This converts the `timestamp` column from `TIMESTAMP(3)` to `BIGINT`.

### Step 2: Restart Backend
```bash
cd backend
npm start
```

The backend now stores relative timestamps directly.

### Step 3: Verify Data
```sql
-- Check timestamp values (should be integers, not dates)
SELECT session_id, event_type, action, timestamp
FROM interaction_logs
LIMIT 10;

-- Example output:
-- session_id            | event_type | action       | timestamp
-- session_123...        | mouse      | cursor_move  | 742
-- session_123...        | keyboard   | key_press    | 1523
-- session_123...        | mouse      | click        | 2104
```

## Frontend Implementation

The frontend already sends relative timestamps:

```typescript
// useInteractionLogger.ts
const logEvent = useCallback((event: Omit<LogEvent, 'timestamp'>) => {
  const timestamp = Date.now() - sessionStartTime; // Relative ms

  const logEntry: LogEvent = {
    ...event,
    timestamp, // This is already a relative BIGINT value
  };

  eventQueueRef.current.push(logEntry);
}, [sessionStartTime]);
```

**No frontend changes needed!** The hook already calculates relative timestamps.

## Query Examples

### 1. Get all events in order
```sql
SELECT * FROM interaction_logs
WHERE session_id = 'session_123'
ORDER BY timestamp ASC;
```

### 2. Get events in a time range
```sql
-- Events between 10 and 20 seconds into the session
SELECT * FROM interaction_logs
WHERE session_id = 'session_123'
  AND timestamp BETWEEN 10000 AND 20000
ORDER BY timestamp ASC;
```

### 3. Calculate event frequency
```sql
-- Events per second
SELECT
  FLOOR(timestamp / 1000) as second,
  COUNT(*) as event_count
FROM interaction_logs
WHERE session_id = 'session_123'
GROUP BY FLOOR(timestamp / 1000)
ORDER BY second;
```

### 4. Time gaps analysis
```sql
-- Find time gaps between events
SELECT
  timestamp,
  (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)) as gap_ms
FROM interaction_logs
WHERE session_id = 'session_123'
ORDER BY timestamp;
```

### 5. Reconstruct absolute timeline
```sql
-- Convert relative to absolute timestamps
SELECT
  il.*,
  DATE_ADD(s.started_at, INTERVAL il.timestamp/1000 SECOND) as absolute_time
FROM interaction_logs il
JOIN sessions s ON s.id = il.session_id
WHERE il.session_id = 'session_123'
ORDER BY il.timestamp;
```

## Data Format Summary

| Field | Type | Example | Meaning |
|-------|------|---------|---------|
| `timestamp` | BIGINT | 742 | 742ms after session start |
| `timestamp` | BIGINT | 8206 | 8.206 seconds after session start |
| `timestamp` | BIGINT | 53405 | 53.405 seconds after session start |

## Best Practices

### ✅ DO:
- Use relative timestamps for all session-related data
- Store absolute session start time in `sessions.started_at`
- Query events by relative timestamp for within-session analysis
- Convert to absolute time only when displaying to users or exporting

### ❌ DON'T:
- Mix relative and absolute timestamps
- Store timezone information (not needed for relative times)
- Parse date strings (timestamps are simple integers)
- Worry about date formatting (it's just milliseconds)

## Conclusion

This schema provides:
- ✅ **Consistency**: Same time reference across all data types
- ✅ **Precision**: Millisecond-level timing
- ✅ **Performance**: Simple integer comparisons
- ✅ **Flexibility**: Easy to analyze temporal patterns
- ✅ **Simplicity**: No timezone or date parsing issues

Perfect for research analysis of user behavior over time! 🎉

# Timestamp Reference Points - Visual Guide

## Timeline Overview

```
Absolute Time (Wall Clock)
│
│  User clicks "I agree"
│  ↓
├─ SESSION START (t=0 for chat & interactions)
│  │
│  │  sessionStartTime = Date.now()
│  │  Reference for: Chat History & Interaction Logs
│  │
│  ├─ t=0ms      → Session starts
│  ├─ t=742ms    → Interaction: cursor_move
│  ├─ t=1000ms   → Recording initialization starts...
│  │
│  │  Recording ready!
│  │  ↓
│  ├─ RECORDING START (t=0 for transcript)
│  │  │
│  │  │  recordingStartTime = Date.now()
│  │  │  Reference for: Transcript Content
│  │  │  Offset from session = ~1000ms
│  │  │
│  │  ├─ t=5420ms  → Chat: User sends message
│  │  ├─ t=8206ms  → Interaction: click event
│  │  │  └─ Transcript t=0ms     → "Hello" (7206ms after session start)
│  │  ├─ t=12340ms → Interaction: key_press
│  │  │  └─ Transcript t=3134ms  → "world" (11340ms after session start)
│  │  └─ t=15000ms → Chat: Assistant responds
│       └─ Transcript t=6794ms  → "How are you" (14000ms after session start)
```

## Data Structure Comparison

### Example Session Data

**Session Info:**
- `session_start_timestamp`: 1697200000000 (absolute epoch ms)
- `recording_start_timestamp`: 1697200001000 (1 second later)
- Recording offset: 1000ms

### 1. Chat Messages (Reference: Session Start)

```json
[
  {
    "role": "user",
    "content": "What is AI?",
    "timestamp": 5420
  },
  {
    "role": "assistant",
    "content": "AI is...",
    "timestamp": 15000
  }
]
```

**Interpretation:**
- First message sent 5.42 seconds after session started
- Response came 15 seconds after session started

### 2. Interaction Logs (Reference: Session Start)

```json
[
  {
    "event_type": "mouse",
    "action": "cursor_move",
    "timestamp": 742
  },
  {
    "event_type": "keyboard",
    "action": "key_press",
    "timestamp": 4200
  },
  {
    "event_type": "mouse",
    "action": "click",
    "timestamp": 5410
  }
]
```

**Interpretation:**
- Cursor moved 0.742 seconds after session started
- Key pressed 4.2 seconds after session started
- Click happened 5.41 seconds after session started (just before sending message!)

### 3. Transcript Content (Reference: Recording Start)

```json
[
  {
    "text": "Hello",
    "timestamp": 0
  },
  {
    "text": "world",
    "timestamp": 3134
  },
  {
    "text": "How are you",
    "timestamp": 6794
  }
]
```

**Interpretation:**
- "Hello" spoken right when recording started (= 1000ms after session start)
- "world" spoken 3.134 seconds after recording started (= 4134ms after session start)
- "How are you" spoken 6.794 seconds after recording started (= 7794ms after session start)

## Converting Between Reference Points

### Transcript → Session Timeline

```javascript
// Convert transcript timestamp to session timeline
function transcriptToSessionTime(transcriptTime, recordingStartOffset) {
  return transcriptTime + recordingStartOffset;
}

// Example:
// Transcript says "Hello" at t=0
// Recording started 1000ms after session
// → "Hello" was at session time 1000ms

const sessionTime = transcriptToSessionTime(0, 1000);
// sessionTime = 1000
```

### Session → Transcript Timeline

```javascript
// Convert session timestamp to transcript timeline
function sessionToTranscriptTime(sessionTime, recordingStartOffset) {
  return Math.max(0, sessionTime - recordingStartOffset);
}

// Example:
// User clicked at session time 5410ms
// Recording started at 1000ms (session time)
// → Click was at transcript time 4410ms

const transcriptTime = sessionToTranscriptTime(5410, 1000);
// transcriptTime = 4410
```

## SQL Queries

### Query 1: Chat & Interactions (Same Reference)

```sql
-- Direct comparison - both use session start
SELECT
  'chat' as type,
  CONCAT(role, ': ', LEFT(content, 50)) as event,
  timestamp as session_time_ms
FROM chat_messages
WHERE session_id = 'session_123'

UNION ALL

SELECT
  'interaction' as type,
  CONCAT(event_type, ' - ', action) as event,
  timestamp as session_time_ms
FROM interaction_logs
WHERE session_id = 'session_123'

ORDER BY session_time_ms ASC;
```

**Output:**
```
type        | event                    | session_time_ms
------------|--------------------------|----------------
interaction | mouse - cursor_move      | 742
interaction | keyboard - key_press     | 4200
interaction | mouse - click            | 5410
chat        | user: What is AI?        | 5420
chat        | assistant: AI is...      | 15000
```

### Query 2: All Events Including Transcript

```sql
-- Need to adjust transcript timestamps
SELECT * FROM (
  SELECT
    'chat' as type,
    content as event,
    timestamp as session_time_ms
  FROM chat_messages
  WHERE session_id = 'session_123'

  UNION ALL

  SELECT
    'interaction' as type,
    action as event,
    timestamp as session_time_ms
  FROM interaction_logs
  WHERE session_id = 'session_123'

  UNION ALL

  SELECT
    'transcript' as type,
    content as event,
    -- Adjust transcript time to session timeline
    (t.timestamp + (s.recording_start_timestamp - s.session_start_timestamp)) as session_time_ms
  FROM transcripts t
  JOIN submissions s ON s.session_id = t.session_id
  WHERE t.session_id = 'session_123'
) combined
ORDER BY session_time_ms ASC;
```

**Output (with recording offset = 1000ms):**
```
type        | event              | session_time_ms
------------|--------------------|-----------------
interaction | cursor_move        | 742
transcript  | Hello              | 1000   (was t=0 in transcript)
interaction | key_press          | 4200
transcript  | world              | 4134   (was t=3134 in transcript)
interaction | click              | 5410
chat        | What is AI?        | 5420
transcript  | How are you        | 7794   (was t=6794 in transcript)
chat        | AI is...           | 15000
```

## Implementation Check

### Frontend (Already Correct ✅)

**App.tsx:**
```javascript
// Line 19: Session start captured
const startTime = Date.now();
setSessionStartTime(startTime);

// Line 65: Passed to ChatInterface
<ChatInterface sessionId={sessionId} sessionStartTime={sessionStartTime} />

// Line 77: Passed to WritingSection (for interactions)
<WritingSection sessionId={sessionId} sessionStartTime={sessionStartTime} />
```

**useInteractionLogger.ts:**
```javascript
// Line 147: Uses session start for relative timestamp
const timestamp = Date.now() - sessionStartTime;
```

**WebRTCTranscript:** Uses its own `recordingStartTime` (different reference)

### Backend (Already Correct ✅)

**logging.ts:**
```javascript
// Line 40: Stores relative timestamp directly
log.timestamp || 0  // Already a relative BIGINT from frontend
```

## Summary

| Data Type | Reference Point | Stored As | Example |
|-----------|----------------|-----------|---------|
| **Chat Messages** | Session Start | BIGINT (ms) | 5420 = 5.42s into session |
| **Interaction Logs** | Session Start | BIGINT (ms) | 742 = 0.742s into session |
| **Transcript** | Recording Start | BIGINT (ms) | 3134 = 3.134s into recording |

**Key Insight:**
- ✅ Chat and Interactions can be directly compared (same reference)
- ⚠️ Transcript needs offset adjustment to align with session timeline
- 📊 Recording typically starts ~1 second after session start

Perfect for research analysis! 🎉

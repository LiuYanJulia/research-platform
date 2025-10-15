# Logging System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERACTIONS                           │
│  (Mouse, Keyboard, Text Selection, UI Clicks)                      │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GLOBAL EVENT LISTENERS                           │
│  (Attached to document - capture ALL events across entire page)    │
│                                                                     │
│  • mousemove, click, dblclick, contextmenu                         │
│  • scroll, mouseenter, mouseleave                                  │
│  • keydown                                                         │
│  • copy, paste, cut                                                │
│  • selectionchange                                                 │
│  • dragstart, dragend                                              │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SECTION DETECTION                                 │
│  getSectionFromElement(event.target)                               │
│                                                                     │
│  Traverses DOM tree upward to find:                                │
│  • .section-chat → 'prompting'                                     │
│  • .section-writing → 'writing'                                    │
│  • article[data-turn] → 'response'                                 │
│  • .section-transcript → 'transcript'                              │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EVENT QUEUE (Client-Side)                        │
│                                                                     │
│  [{eventType, action, target, timestamp, metadata}, ...]          │
│                                                                     │
│  Batching Logic:                                                   │
│  • Queue up to 50 events OR                                        │
│  • Every 5 seconds                                                 │
│  → Trigger sendBatch()                                             │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BATCH API REQUEST                                 │
│  POST /api/logging/batch                                           │
│  {                                                                  │
│    sessionId: "session_123",                                       │
│    logs: [...]                                                     │
│  }                                                                  │
└────────────────┬────────────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DATABASE (MySQL)                                  │
│  interaction_logs table                                            │
│  • session_id, event_type, action                                  │
│  • target_element, target_section                                  │
│  • coordinates (JSON), metadata (JSON)                             │
│  • timestamp (TIMESTAMP(3))                                        │
└─────────────────────────────────────────────────────────────────────┘
```

## Event Flow by Section

### ChatInterface (Prompting + Response)

```
┌───────────────────────────────────────────────────────────┐
│            ChatInterface Component                        │
│  <div className="section-chat">                          │
│                                                           │
│    ┌─────────────────────────────────────┐              │
│    │  Prompt Input (Textarea)            │              │
│    │  - Mouse: cursor, click, scroll     │◄─────┐       │
│    │  - Keyboard: keypress, shortcuts    │      │       │
│    │  - Selection: text selection        │      │       │
│    │  - UI: focus, blur                  │      │       │
│    └─────────────────────────────────────┘      │       │
│                                                  │       │
│    ┌─────────────────────────────────────┐      │       │
│    │  Message Thread                     │      │       │
│    │  <article data-turn="assistant">    │      │       │
│    │  - Mouse: cursor, click, hover      │◄─────┤       │
│    │  - Keyboard: keypress               │      │       │
│    │  - Selection: text selection        │      │  Global Event
│    │  - UI: copy, feedback, regenerate   │      │  Listeners
│    └─────────────────────────────────────┘      │  Detect Section
│                                                  │  = 'prompting'
│    ┌─────────────────────────────────────┐      │  or 'response'
│    │  Action Buttons                     │      │       │
│    │  - Copy, Good, Bad, Regenerate      │◄─────┘       │
│    │  - UI: button_click, message_action │              │
│    └─────────────────────────────────────┘              │
│                                                           │
│  </div>                                                  │
└───────────────────────────────────────────────────────────┘
```

**Events Tracked:**
1. **Mouse**: Cursor movement, clicks (on input, messages, buttons), scroll (messages), hover (buttons)
2. **Keyboard**: Key presses (while typing prompt), shortcuts (Ctrl+C/V), text editing
3. **Selection**: Text selection (in prompt input or messages)
4. **UI**: Prompt submission, message copy, feedback clicks, regenerate toggle

### WritingSection

```
┌───────────────────────────────────────────────────────────┐
│            WritingSection Component                       │
│  <div className="section-writing">                       │
│                                                           │
│    ┌─────────────────────────────────────┐              │
│    │  Writing Textarea (Large)           │              │
│    │  - Mouse: cursor, click, scroll     │◄─────┐       │
│    │  - Keyboard: keypress, shortcuts    │      │       │
│    │  - Keyboard: text_insert/delete     │      │       │
│    │  - Selection: text selection        │      │  Global Event
│    │  - UI: focus, blur                  │      │  Listeners
│    └─────────────────────────────────────┘      │  Detect Section
│                                                  │  = 'writing'
│    ┌─────────────────────────────────────┐      │       │
│    │  Control Buttons                    │      │       │
│    │  - Clear Button                     │◄─────┤       │
│    │  - Submit Button                    │      │       │
│    │  - UI: button_click, form_submit    │◄─────┘       │
│    └─────────────────────────────────────┘              │
│                                                           │
│  </div>                                                  │
└───────────────────────────────────────────────────────────┘
```

**Events Tracked:**
1. **Mouse**: Cursor movement, clicks (on textarea, buttons), scroll (content), hover (buttons)
2. **Keyboard**: Key presses (while writing), shortcuts (Ctrl+C/V/A), text editing
3. **Selection**: Text selection (in writing area)
4. **UI**: Textarea focus/blur, clear button, submit button

## Data Flow Example

### Example: User types in ChatInterface prompt input

```
1. User presses 'H' key
   ↓
2. keydown event fires
   ↓
3. Global keydown listener catches it
   ↓
4. getSectionFromElement(textarea) → 'prompting'
   ↓
5. logEvent({
      eventType: 'keyboard',
      action: 'key_press',
      target: {
        element: '[placeholder="Ask anything"]',
        section: 'prompting'
      },
      metadata: { key: 'h', code: 'KeyH' }
   })
   ↓
6. Event added to queue
   ↓
7. User continues typing...
   ↓
8. After 50 events OR 5 seconds → sendBatch()
   ↓
9. POST /api/logging/batch
   ↓
10. Backend saves to database with session_id
```

### Example: User selects text in WritingSection

```
1. User selects text "research findings"
   ↓
2. selectionchange event fires
   ↓
3. Global selectionchange listener catches it
   ↓
4. getSectionFromElement(textarea) → 'writing'
   ↓
5. logEvent({
      eventType: 'selection',
      action: 'text_select',
      target: {
        element: 'writing-textarea',
        section: 'writing',
        text: 'research findings'
      },
      metadata: {
        textLength: 17,
        startOffset: 42,
        endOffset: 59
      }
   })
   ↓
6. Event added to queue → batched → sent to backend
```

## Component Integration Points

### useInteractionLogger Hook

```typescript
// Initialized in both components
const logger = useInteractionLogger({
  sessionId: 'session_123',
  sessionStartTime: 1234567890,
  batchSize: 50,
  batchInterval: 5000,
  enableCursorTracking: true,
  cursorThrottle: 100,
  enableScrollTracking: true,
  scrollThrottle: 200,
});
```

### Global Listeners (Automatic)
- Attached to `document` on hook mount
- Capture events from entire page
- Use `event.target` to detect section
- Work for ALL elements in ChatInterface and WritingSection

### Manual Logging (Component-Specific)
```typescript
// In ChatInterface - Send button
logger.logEvent({
  eventType: 'ui',
  action: 'composer_interaction',
  target: { element: 'send-button', section: 'prompting' },
  metadata: { promptLength: 42 }
});

// In WritingSection - Submit button
logger.logEvent({
  eventType: 'ui',
  action: 'form_submit',
  target: { element: 'submit-final-work-button', section: 'writing' },
  metadata: { wordCount: 250, charCount: 1523 }
});
```

## Performance Optimizations

### Throttling
```
High-Frequency Events:
┌────────────────────────────────────┐
│ mousemove: Every 100ms max         │  Reduces 1000/sec → 10/sec
│ scroll: Every 200ms max            │  Reduces 500/sec → 5/sec
└────────────────────────────────────┘
```

### Batching
```
Network Requests:
┌────────────────────────────────────┐
│ Without batching: 1 request/event │  1000 events = 1000 requests
│ With batching: 1 request/50 events│  1000 events = 20 requests
│                                    │  95% reduction!
└────────────────────────────────────┘
```

### Hover Detection
```
Hover Events:
┌────────────────────────────────────┐
│ 300ms delay before logging         │  Filters out accidental hovers
│ Only on interactive elements       │  Reduces noise
└────────────────────────────────────┘
```

## Database Schema

```sql
CREATE TABLE interaction_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(36) NOT NULL,              -- Links to session
  event_type ENUM('mouse','keyboard','ui',      -- Event category
                  'api','session','selection'),
  action VARCHAR(100) NOT NULL,                 -- Specific action
  target_element VARCHAR(255),                  -- Element identifier
  target_section ENUM('prompting','transcript', -- UI section
                      'response','writing'),
  coordinates JSON,                             -- {x, y} or {x, y, scrollHeight, ...}
  text_content TEXT,                            -- Selected text or input value
  metadata JSON,                                -- Flexible event-specific data
  timestamp TIMESTAMP(3),                       -- Millisecond precision

  INDEX idx_session_timestamp (session_id, timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_action (action)
);
```

## Query Examples

### Get all events for a session
```sql
SELECT * FROM interaction_logs
WHERE session_id = 'session_123'
ORDER BY timestamp;
```

### Events by section and type
```sql
SELECT
  target_section,
  event_type,
  COUNT(*) as count
FROM interaction_logs
WHERE session_id = 'session_123'
GROUP BY target_section, event_type;
```

### User typing patterns
```sql
SELECT
  action,
  COUNT(*) as count,
  AVG(TIMESTAMPDIFF(MICROSECOND,
    LAG(timestamp) OVER (ORDER BY timestamp),
    timestamp
  )) / 1000 as avg_interval_ms
FROM interaction_logs
WHERE session_id = 'session_123'
  AND event_type = 'keyboard'
  AND target_section IN ('prompting', 'writing')
GROUP BY action;
```

## Summary

✅ **All 4 event types tracked in BOTH sections automatically**
✅ **Global listeners → no need to manually add to each element**
✅ **Intelligent section detection via DOM traversal**
✅ **Performance optimized with throttling and batching**
✅ **Flexible metadata for event-specific data**
✅ **Millisecond-precision timestamps**

The system is **production-ready** and requires **no additional configuration** to track user interactions comprehensively!

# Interaction Logging System Documentation

## Overview

The research platform now includes a comprehensive interaction logging system that captures user actions and behaviors across all UI components. This system is designed to track meaningful user interactions that show or imply user intention and thinking processes.

## Architecture

### Client-Side (Frontend)

**Core Hook: `useInteractionLogger`**
- Location: `frontend/src/hooks/useInteractionLogger.ts`
- Automatic event capture for mouse, keyboard, selection, and UI interactions
- Batching mechanism for efficient network transmission
- Configurable throttling for high-frequency events

**Integration Points:**
- `ChatInterface.tsx` - Tracks prompting, message actions, feedback
- `WritingSection.tsx` - Tracks text editing, focus/blur, submissions

### Server-Side (Backend)

**API Endpoints:**
- `POST /api/logging/batch` - Batch log submission (recommended)
- `POST /api/logging/single` - Single log submission
- `GET /api/logging/:sessionId` - Retrieve logs for a session
- `GET /api/logging/:sessionId/stats` - Get statistics for a session

**Database:**
- Table: `interaction_logs`
- Timestamps: Millisecond precision (TIMESTAMP(3))
- Indexes: Optimized for session and time-based queries

## Event Taxonomy

### Event Types

#### 1. Mouse Events (`eventType: 'mouse'`)

**Actions:**
- `cursor_move` - Mouse cursor movement (throttled to 100ms)
- `click` - Left mouse button click
- `right_click` - Right mouse button click / context menu
- `middle_click` - Middle mouse button click
- `double_click` - Double click
- `hover_start` - Hover on interactive element (300ms delay)
- `hover_end` - Hover end on interactive element
- `drag_start` - Drag operation start
- `drag_end` - Drag operation end
- `scroll` - Scroll event (throttled to 200ms)

**Captured Data:**
- Coordinates (x, y)
- Target element identifier
- UI section (prompting, response, writing, transcript)

#### 2. Keyboard Events (`eventType: 'keyboard'`)

**Actions:**
- `key_press` - Individual key press
- `text_insert` - Text insertion detected (via global input event listener)
- `text_delete` - Text deletion detected (via global input event listener)
- `copy` - Copy operation (Ctrl/Cmd+C)
- `paste` - Paste operation (Ctrl/Cmd+V)
- `cut` - Cut operation (Ctrl/Cmd+X)
- `keyboard_shortcut` - Other keyboard shortcuts

**Captured Data:**
- Key pressed
- Modifier keys (Ctrl, Shift, Alt, Meta)
- Text content (for copy/cut, limited to 200 chars)
- Character delta (for insert/delete)
- Previous and new length (for insert/delete)

#### 3. Selection Events (`eventType: 'selection'`)

**Actions:**
- `text_select` - Text selection made
- `selection_clear` - Text selection cleared
- `cursor_position_change` - Cursor position changed

**Captured Data:**
- Selected text (limited to 200 chars)
- Text length
- Start/end offsets
- Target element

#### 4. UI Events (`eventType: 'ui'`)

**Actions:**
- `button_click` - Button click
- `form_submit` - Form submission
- `input_focus` - Input field focused
- `input_blur` - Input field blurred
- `composer_interaction` - Chat composer interaction
- `message_action` - Message-related actions
- `navigation` - Navigation events

**Captured Data:**
- Element identifier (data-testid, id, aria-label)
- Action type metadata
- Context-specific data (message ID, prompt length, etc.)

## Data Structure

### LogEvent Interface

```typescript
interface LogEvent {
  eventType: 'mouse' | 'keyboard' | 'selection' | 'ui';
  action: string;
  timestamp: number; // Milliseconds relative to session start
  target?: {
    element?: string; // Element identifier
    section?: 'prompting' | 'transcript' | 'response' | 'writing';
    coordinates?: { x: number; y: number };
    text?: string; // Selected text or button label
  };
  metadata?: Record<string, any>; // Flexible event-specific data
}
```

### Database Schema

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
  timestamp TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP(3),
  -- Indexes for performance
  INDEX idx_session_timestamp (session_id, timestamp),
  INDEX idx_event_type (event_type),
  INDEX idx_action (action)
);
```

## Usage Examples

### 1. Initialize Logger in a Component

```typescript
import { useInteractionLogger } from '../hooks/useInteractionLogger';

const MyComponent = ({ sessionId, sessionStartTime }) => {
  const logger = useInteractionLogger({
    sessionId,
    sessionStartTime,
    batchSize: 50,        // Send batch every 50 events
    batchInterval: 5000,  // Or every 5 seconds
    enableCursorTracking: true,
    cursorThrottle: 100,  // Log cursor every 100ms
    enableScrollTracking: true,
    scrollThrottle: 200,  // Log scroll every 200ms
  });

  // Logger automatically tracks global events
  // Manual logging for specific UI actions:

  const handleButtonClick = () => {
    logger.logEvent({
      eventType: 'ui',
      action: 'button_click',
      target: {
        element: 'submit-button',
        section: 'writing',
      },
      metadata: {
        customData: 'value',
      },
    });
  };
};
```

### 2. Query Logs via API

```bash
# Get all logs for a session
GET /api/logging/:sessionId

# Filter by event type
GET /api/logging/:sessionId?eventType=mouse

# Filter by action
GET /api/logging/:sessionId?action=click

# Pagination
GET /api/logging/:sessionId?limit=100&offset=0

# Get statistics
GET /api/logging/:sessionId/stats
```

### 3. Batch Submit Logs

```javascript
POST /api/logging/batch
{
  "sessionId": "session_123",
  "logs": [
    {
      "eventType": "mouse",
      "action": "click",
      "timestamp": 1234,
      "target": {
        "element": "button",
        "section": "prompting",
        "coordinates": { "x": 100, "y": 200 }
      }
    }
  ]
}
```

## Tracked Interactions by Component

### ChatInterface

- **Prompt Submission:** Tracks send button clicks with prompt length
- **Copy Message:** Tracks copy actions with message ID
- **Feedback (Good/Bad):** Tracks user feedback on responses
- **Regenerate Menu:** Tracks toggle of regenerate options
- **Contextual Prompts:** Tracks "Try again", "Add details", "More concise", etc.
- **Message Navigation:** Automatic tracking via global listeners

### WritingSection

- **Text Editing:** Tracks insertions/deletions with character deltas
- **Focus/Blur:** Tracks when textarea gains/loses focus
- **Clear Content:** Tracks clear button with content statistics
- **Final Submission:** Tracks submission with word/char counts
- **Auto-save:** Indirectly tracked through text edit events

### Global Tracking (All Components)

- **Cursor Movement:** Throttled to 100ms intervals
- **Clicks:** All click types with element identification
- **Hover:** On interactive elements with 300ms delay
- **Scroll:** Throttled to 200ms with position tracking
- **Keyboard Shortcuts:** Ctrl/Cmd combinations
- **Key Presses:** Individual key events with modifiers
- **Text Insert/Delete:** Character-level changes in all input/textarea elements
- **Text Selection:** Selection start/end with content preview
- **Copy/Paste/Cut:** Clipboard operations with text preview

## Performance Considerations

### Batching
- Events are queued client-side
- Batch sent when queue reaches 50 events OR every 5 seconds
- Reduces network requests by ~95%

### Throttling
- Cursor movement: 100ms (max 10 events/second)
- Scroll events: 200ms (max 5 events/second)
- Hover detection: 300ms delay (reduces noise)

### Data Privacy
- Text content limited to 200 characters max
- No sensitive data (passwords, etc.) captured
- Focus on behavioral patterns, not content

### Database Optimization
- Indexes on session_id + timestamp for fast queries
- JSON columns for flexible metadata
- TIMESTAMP(3) for millisecond precision

## Best Practices

### 1. Use Descriptive Element Identifiers
```jsx
// Good
<button data-testid="submit-final-work-button">Submit</button>

// Also Good
<button id="submitButton">Submit</button>

// Less Ideal
<button className="btn">Submit</button>
```

### 2. Add Meaningful Metadata
```typescript
logger.logEvent({
  eventType: 'ui',
  action: 'button_click',
  metadata: {
    actionType: 'submission',
    wordCount: 250,
    submissionAttempt: 1,
  },
});
```

### 3. Use Appropriate Sections
- `prompting` - Chat interface, composer
- `response` - LLM responses, message threads
- `writing` - Writing/submission area
- `transcript` - Voice transcript section

### 4. Batch Operations
The hook automatically batches events. Don't manually send individual events unless critical:

```typescript
// Let the hook batch automatically (preferred)
logger.logEvent({ ... });

// Manual flush (only if needed)
logger.sendBatch();
```

## Migration Notes

If you have an existing database, run the migration:

```bash
mysql -u root -p research_platform < backend/database/migrate_add_selection_event_type.sql
```

This adds the 'selection' event type to the ENUM.

## Testing

To verify logging is working:

1. Start the application
2. Interact with the UI (click, type, select text)
3. Check browser console for any errors
4. Query the database:
   ```sql
   SELECT * FROM interaction_logs
   WHERE session_id = 'your_session_id'
   ORDER BY timestamp DESC
   LIMIT 20;
   ```
5. Use the stats endpoint to verify event counts

## Future Enhancements

Potential additions:
- Real-time event streaming via WebSocket
- Client-side event replay for session reconstruction
- Machine learning model training data export
- Heatmap visualization from cursor/click data
- Anomaly detection for unusual behavior patterns
- A/B testing support with event tagging

## Troubleshooting

### Events Not Logging
1. Check browser console for errors
2. Verify sessionId and sessionStartTime are provided
3. Check network tab for failed API requests
4. Verify database connection

### Performance Issues
1. Increase throttle intervals
2. Reduce batch size
3. Disable cursor tracking if not needed
4. Check database query performance

### Missing Events
1. Verify element has proper identifier (data-testid, id, etc.)
2. Check if event is within a tracked section
3. Ensure logger is initialized before interactions occur

## Contact

For questions or issues with the logging system, please refer to the main project documentation or contact the development team.

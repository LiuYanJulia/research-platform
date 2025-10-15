# Logging System Verification Guide

## Confirming All 4 Event Types Are Tracked in ChatInterface and WritingSection

The logging system automatically tracks **all 4 event types** (Mouse, Keyboard, Selection, UI) in **both sections** through global event listeners that detect which section the event occurred in.

## How Section Detection Works

Every event handler calls `getSectionFromElement()` which:
1. Takes the event target element
2. Traverses up the DOM tree
3. Looks for section markers:
   - `section-chat` class → `'prompting'` section (ChatInterface)
   - `section-writing` class → `'writing'` section (WritingSection)
   - `ARTICLE[data-turn]` → `'response'` section (Message responses)
   - `section-transcript` class → `'transcript'` section

## Verification Steps

### Step 1: Start the Application
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```

### Step 2: Perform Test Actions

#### In ChatInterface (Prompting Section):
1. **Mouse tracking:**
   - Move cursor around the chat area
   - Click on text input
   - Scroll through messages
   - Hover over buttons

2. **Keyboard tracking:**
   - Type in the prompt textarea
   - Press Ctrl+C to copy
   - Press Ctrl+V to paste
   - Use keyboard shortcuts

3. **Selection tracking:**
   - Select text in a message
   - Select text in the input field
   - Clear selection

4. **UI tracking:**
   - Click send button
   - Click feedback buttons
   - Toggle regenerate menu

#### In WritingSection:
1. **Mouse tracking:**
   - Move cursor in writing area
   - Click in the textarea
   - Scroll the writing area
   - Hover over submit button

2. **Keyboard tracking:**
   - Type in the writing textarea
   - Press Ctrl+C to copy your writing
   - Press Ctrl+V to paste
   - Use Ctrl+A to select all

3. **Selection tracking:**
   - Select text in the writing area
   - Clear selection

4. **UI tracking:**
   - Focus the textarea
   - Blur the textarea
   - Click clear button
   - Click submit button

### Step 3: Query the Database

Check that events are logged with correct sections:

```sql
-- See all event types by section
SELECT
  target_section as section,
  event_type,
  COUNT(*) as count
FROM interaction_logs
WHERE session_id = 'your_session_id'
GROUP BY target_section, event_type
ORDER BY target_section, event_type;
```

Expected output should show:
```
+------------+-----------+-------+
| section    | event_type| count |
+------------+-----------+-------+
| prompting  | mouse     | XXX   |
| prompting  | keyboard  | XXX   |
| prompting  | selection | XXX   |
| prompting  | ui        | XXX   |
| response   | mouse     | XXX   |
| response   | keyboard  | XXX   |
| response   | selection | XXX   |
| response   | ui        | XXX   |
| writing    | mouse     | XXX   |
| writing    | keyboard  | XXX   |
| writing    | selection | XXX   |
| writing    | ui        | XXX   |
+------------+-----------+-------+
```

### Step 4: Detailed Action Breakdown

Check specific actions per section:

```sql
-- ChatInterface (prompting + response)
SELECT action, COUNT(*) as count
FROM interaction_logs
WHERE session_id = 'your_session_id'
  AND target_section IN ('prompting', 'response')
GROUP BY action
ORDER BY count DESC;
```

Expected actions in ChatInterface:
- `cursor_move` - Cursor tracking
- `click` - Clicks in chat area
- `key_press` - Typing in prompt
- `text_select` - Text selection
- `copy`, `paste`, `cut` - Clipboard operations
- `composer_interaction` - Send button
- `message_action` - Copy, feedback, regenerate
- `scroll` - Scrolling messages

```sql
-- WritingSection
SELECT action, COUNT(*) as count
FROM interaction_logs
WHERE session_id = 'your_session_id'
  AND target_section = 'writing'
GROUP BY action
ORDER BY count DESC;
```

Expected actions in WritingSection:
- `cursor_move` - Cursor tracking
- `click` - Clicks in writing area
- `key_press` - Typing
- `text_insert` - Character insertions
- `text_delete` - Character deletions
- `text_select` - Text selection
- `copy`, `paste`, `cut` - Clipboard operations
- `input_focus` - Focus textarea
- `input_blur` - Blur textarea
- `button_click` - Clear button
- `form_submit` - Submit button
- `scroll` - Scrolling content

### Step 5: Verify Element Identification

Check that elements are properly identified:

```sql
-- Check elements being tracked
SELECT
  target_element,
  target_section,
  event_type,
  action,
  COUNT(*) as count
FROM interaction_logs
WHERE session_id = 'your_session_id'
GROUP BY target_element, target_section, event_type, action
ORDER BY count DESC
LIMIT 20;
```

Should see identifiers like:
- `[placeholder="Ask anything"]` - Chat prompt input
- `[data-testid="copy-turn-action-button"]` - Copy button
- `[data-testid="good-response-turn-action-button"]` - Feedback button
- `writing-textarea` or `textarea.classname` - Writing textarea
- `clear-button` - Clear button
- `submit-final-work-button` - Submit button

### Step 6: Sample Detailed Event

View a complete event with all fields:

```sql
SELECT
  id,
  event_type,
  action,
  target_element,
  target_section,
  coordinates,
  text_content,
  metadata,
  timestamp
FROM interaction_logs
WHERE session_id = 'your_session_id'
  AND event_type = 'keyboard'
  AND action = 'key_press'
LIMIT 1;
```

## Code References

All tracking is implemented in these locations:

### Global Event Listeners (Automatic)
- **Mouse tracking:** `useInteractionLogger.ts:182-309, 314-377, 548-589`
  - Cursor movement, clicks, scroll, hover, drag/drop
  - All track section via `getSectionFromElement(e.target)`

- **Keyboard tracking:** `useInteractionLogger.ts:382-499, 591-650`
  - Key presses, shortcuts, copy/paste/cut
  - **Text insert/delete:** Global input event listener tracks all textarea/input changes
  - All track section via `getSectionFromElement(e.target)`

- **Selection tracking:** `useInteractionLogger.ts:504-543`
  - Text selection, selection clear
  - Tracks section via `getSectionFromElement(element)`

### Component-Specific Logging (Manual)
- **ChatInterface:** Lines 44-61, 71-84, 205-218, 344-357, 808-823
  - Copy message action
  - Feedback actions
  - Prompt submission
  - Contextual prompts
  - Regenerate toggle

- **WritingSection:** Lines 189-201, 269-302, 110-122
  - Focus/blur events
  - Clear button
  - Submit button
  - Note: Text insert/delete now tracked globally

### Section Detection
- **Function:** `useInteractionLogger.ts:599-616`
- **Logic:**
  ```typescript
  if (classes.includes('section-chat')) return 'prompting';
  if (classes.includes('section-writing')) return 'writing';
  if (current.tagName === 'ARTICLE' && current.getAttribute('data-turn')) return 'response';
  ```

## Expected Behavior Summary

| Event Type | ChatInterface | WritingSection | Auto/Manual |
|------------|--------------|----------------|-------------|
| Mouse (cursor_move) | ✅ | ✅ | Auto |
| Mouse (click) | ✅ | ✅ | Auto |
| Mouse (scroll) | ✅ | ✅ | Auto |
| Mouse (hover) | ✅ | ✅ | Auto |
| Mouse (drag) | ✅ | ✅ | Auto |
| Keyboard (key_press) | ✅ | ✅ | Auto |
| Keyboard (copy/paste/cut) | ✅ | ✅ | Auto |
| Keyboard (shortcuts) | ✅ | ✅ | Auto |
| Keyboard (text_insert) | ✅ | ✅ | Auto (global input listener) |
| Keyboard (text_delete) | ✅ | ✅ | Auto (global input listener) |
| Selection (text_select) | ✅ | ✅ | Auto |
| Selection (selection_clear) | ✅ | ✅ | Auto |
| UI (button_click) | ✅ | ✅ | Manual |
| UI (composer_interaction) | ✅ | - | Manual |
| UI (message_action) | ✅ | - | Manual |
| UI (input_focus) | - | ✅ | Manual |
| UI (input_blur) | - | ✅ | Manual |
| UI (form_submit) | - | ✅ | Manual |

All events are tracked globally by the useInteractionLogger hook with intelligent section detection

## Troubleshooting

### Issue: No events showing for a section
**Check:**
1. Verify section has correct class name (`section-chat` or `section-writing`)
2. Check browser console for errors
3. Verify logger is initialized with valid sessionId and sessionStartTime

### Issue: Wrong section attribution
**Check:**
1. DOM structure - ensure section wrapper exists
2. `getSectionFromElement()` function traversal logic
3. CSS class names match exactly

### Issue: Missing specific event types
**Check:**
1. Browser console for JavaScript errors
2. Event listener attachment (should happen on component mount)
3. Network tab for failed API requests

## Conclusion

The logging system tracks **ALL 4 event types** in **BOTH sections** automatically through global event listeners with intelligent section detection. No additional configuration needed!

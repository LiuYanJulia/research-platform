import { useEffect, useRef, useCallback } from 'react';

/**
 * Event Taxonomy for Research Platform Interaction Logging
 *
 * Event Types:
 * - mouse: Mouse movements, clicks, hover, drag, scroll
 * - keyboard: Key presses, text changes, shortcuts
 * - selection: Text selection and cursor position changes
 * - ui: Button clicks, form interactions, navigation
 */

// Type definitions for event logging
export type EventType = 'mouse' | 'keyboard' | 'selection' | 'ui';

export type MouseAction =
  | 'cursor_move'
  | 'click'
  | 'right_click'
  | 'middle_click'
  | 'double_click'
  | 'hover_start'
  | 'hover_end'
  | 'drag_start'
  | 'drag_end'
  | 'scroll';

export type KeyboardAction =
  | 'key_press'
  | 'text_insert'
  | 'text_delete'
  | 'copy'
  | 'paste'
  | 'cut'
  | 'keyboard_shortcut';

export type SelectionAction =
  | 'text_select'
  | 'selection_clear'
  | 'cursor_position_change';

export type UIAction =
  | 'button_click'
  | 'form_submit'
  | 'input_focus'
  | 'input_blur'
  | 'composer_interaction'
  | 'message_action'
  | 'navigation';

export type Section = 'prompting' | 'transcript' | 'response' | 'writing';

export interface LogEvent {
  eventType: EventType;
  action: string;
  timestamp: number; // Milliseconds relative to session start
  target?: {
    element?: string; // Element type or data-testid
    section?: Section; // Which UI section
    coordinates?: { x: number; y: number }; // Mouse position or scroll position
    text?: string; // Selected text, input value, or button label
  };
  metadata?: Record<string, any>; // Flexible field for event-specific data
}

export interface UseInteractionLoggerOptions {
  sessionId: string;
  sessionStartTime: number;
  batchSize?: number; // Number of events before sending (default: 50)
  batchInterval?: number; // Time in ms between batches (default: 5000)
  enableCursorTracking?: boolean; // Enable cursor movement logging (default: true)
  cursorThrottle?: number; // Throttle cursor events (ms, default: 100)
  enableScrollTracking?: boolean; // Enable scroll logging (default: true)
  scrollThrottle?: number; // Throttle scroll events (ms, default: 200)
}

/**
 * Custom React hook for comprehensive interaction logging
 *
 * Usage:
 * const logger = useInteractionLogger({
 *   sessionId: 'session_123',
 *   sessionStartTime: Date.now()
 * });
 *
 * // Log custom events
 * logger.logEvent({
 *   eventType: 'ui',
 *   action: 'button_click',
 *   target: { element: 'send-button', section: 'prompting' }
 * });
 */
export const useInteractionLogger = (options: UseInteractionLoggerOptions) => {
  const {
    sessionId,
    sessionStartTime,
    batchSize = 50,
    batchInterval = 5000,
    enableCursorTracking = true,
    cursorThrottle = 100,
    enableScrollTracking = true,
    scrollThrottle = 200,
  } = options;

  const eventQueueRef = useRef<LogEvent[]>([]);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorTimeRef = useRef<number>(0);
  const lastScrollTimeRef = useRef<number>(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentHoverTargetRef = useRef<string | null>(null);
  const inputValuesRef = useRef<Map<HTMLElement, string>>(new Map());
  const hasActiveSelectionRef = useRef<boolean>(false); // Track if there's an active text selection

  /**
   * Send batched events to the server
   */
  const sendBatch = useCallback(async () => {
    if (eventQueueRef.current.length === 0) return;

    const eventsToSend = [...eventQueueRef.current];
    eventQueueRef.current = [];

    try {
      const response = await fetch('/api/logging/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          logs: eventsToSend,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send interaction logs:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending interaction logs:', error);
      // Re-queue events on failure (optional - could implement retry logic)
      eventQueueRef.current = [...eventsToSend, ...eventQueueRef.current];
    }
  }, [sessionId]);

  /**
   * Add event to queue and trigger batch send if needed
   */
  const logEvent = useCallback((event: Omit<LogEvent, 'timestamp'>) => {
    const timestamp = Date.now() - sessionStartTime;

    const logEntry: LogEvent = {
      ...event,
      timestamp,
    };

    eventQueueRef.current.push(logEntry);

    // Send batch if queue is full
    if (eventQueueRef.current.length >= batchSize) {
      sendBatch();
    }
  }, [sessionStartTime, batchSize, sendBatch]);

  /**
   * Initialize batch timer
   */
  useEffect(() => {
    batchTimerRef.current = setInterval(() => {
      sendBatch();
    }, batchInterval);

    return () => {
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
      // Send any remaining events on unmount
      sendBatch();
    };
  }, [batchInterval, sendBatch]);

  /**
   * Mouse cursor tracking (throttled)
   */
  useEffect(() => {
    if (!enableCursorTracking) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorTimeRef.current < cursorThrottle) return;

      lastCursorTimeRef.current = now;

      const section = getSectionFromElement(e.target as HTMLElement);

      logEvent({
        eventType: 'mouse',
        action: 'cursor_move',
        target: {
          coordinates: { x: e.clientX, y: e.clientY },
          section,
        },
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [enableCursorTracking, cursorThrottle, logEvent]);

  /**
   * Mouse click tracking
   */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      let action: MouseAction = 'click';
      if (e.button === 1) action = 'middle_click';
      else if (e.button === 2) action = 'right_click';

      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      // Get button information (text and hover message)
      const buttonInfo = getButtonInfo(target);

      logEvent({
        eventType: 'mouse',
        action,
        target: {
          element,
          section,
          coordinates: { x: e.clientX, y: e.clientY },
        },
        metadata: buttonInfo,
      });
    };

    const handleDoubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);
      const buttonInfo = getButtonInfo(target);

      logEvent({
        eventType: 'mouse',
        action: 'double_click',
        target: {
          element,
          section,
          coordinates: { x: e.clientX, y: e.clientY },
        },
        metadata: buttonInfo,
      });
    };

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);
      const buttonInfo = getButtonInfo(target);

      logEvent({
        eventType: 'mouse',
        action: 'right_click',
        target: {
          element,
          section,
          coordinates: { x: e.clientX, y: e.clientY },
        },
        metadata: buttonInfo,
      });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('dblclick', handleDoubleClick);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('dblclick', handleDoubleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [logEvent]);

  /**
   * Scroll tracking (throttled)
   */
  useEffect(() => {
    if (!enableScrollTracking) return;

    const handleScroll = (e: Event) => {
      const now = Date.now();
      if (now - lastScrollTimeRef.current < scrollThrottle) return;

      lastScrollTimeRef.current = now;

      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);

      logEvent({
        eventType: 'mouse',
        action: 'scroll',
        target: {
          section,
          coordinates: {
            x: target.scrollLeft || window.scrollX,
            y: target.scrollTop || window.scrollY
          },
        },
        metadata: {
          scrollHeight: target.scrollHeight || document.documentElement.scrollHeight,
          clientHeight: target.clientHeight || window.innerHeight,
        },
      });
    };

    // Listen to scroll events on window and scrollable containers
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [enableScrollTracking, scrollThrottle, logEvent]);

  /**
   * Hover tracking
   */
  useEffect(() => {
    const handleMouseEnter = (e: MouseEvent) => {
      if (!e.target) return;
      const target = e.target as HTMLElement;

      // Validate target is an HTMLElement
      if (!target || !(target instanceof HTMLElement)) return;

      // Only track hover on interactive elements
      if (!isInteractiveElement(target)) return;

      const element = getElementIdentifier(target);
      const section = getSectionFromElement(target);

      currentHoverTargetRef.current = element;

      // Delay logging hover to avoid noise (only log if hover lasts 300ms)
      hoverTimeoutRef.current = setTimeout(() => {
        logEvent({
          eventType: 'mouse',
          action: 'hover_start',
          target: {
            element,
            section,
            coordinates: { x: e.clientX, y: e.clientY },
          },
        });
      }, 300);
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (!e.target) return;
      const target = e.target as HTMLElement;

      // Validate target is an HTMLElement
      if (!target || !(target instanceof HTMLElement)) return;

      if (!isInteractiveElement(target)) return;

      const element = getElementIdentifier(target);
      const section = getSectionFromElement(target);

      // Clear pending hover start
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }

      // Only log hover end if we logged hover start
      if (currentHoverTargetRef.current === element) {
        logEvent({
          eventType: 'mouse',
          action: 'hover_end',
          target: {
            element,
            section,
          },
        });
        currentHoverTargetRef.current = null;
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);

    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [logEvent]);

  /**
   * Keyboard tracking
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      // Check for keyboard shortcuts
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (['c', 'v', 'x', 'z', 'y', 'a', 's'].includes(key)) {
          logEvent({
            eventType: 'keyboard',
            action: 'keyboard_shortcut',
            target: { element, section },
            metadata: {
              shortcut: `${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${e.key.toUpperCase()}`,
              key: e.key,
              ctrlKey: e.ctrlKey,
              metaKey: e.metaKey,
              shiftKey: e.shiftKey,
              altKey: e.altKey,
            },
          });
          return;
        }
      }

      // Log individual key presses (excluding modifier keys)
      if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        const metadata: Record<string, any> = {
          key: e.key,
          code: e.code,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        };

        // For Backspace/Delete, try to capture what character will be deleted
        if ((e.key === 'Backspace' || e.key === 'Delete') &&
            target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
          const inputTarget = target as HTMLInputElement | HTMLTextAreaElement;
          const cursorPos = inputTarget.selectionStart || 0;
          const value = inputTarget.value;

          if (e.key === 'Backspace' && cursorPos > 0) {
            // Backspace deletes character before cursor
            metadata.deletedChar = value.charAt(cursorPos - 1);
          } else if (e.key === 'Delete' && cursorPos < value.length) {
            // Delete key deletes character after cursor
            metadata.deletedChar = value.charAt(cursorPos);
          }
        }

        logEvent({
          eventType: 'keyboard',
          action: 'key_press',
          target: { element, section },
          metadata,
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [logEvent]);

  /**
   * Copy/Paste tracking
   */
  useEffect(() => {
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);
      const selectedText = window.getSelection()?.toString();

      logEvent({
        eventType: 'keyboard',
        action: 'copy',
        target: {
          element,
          section,
          text: selectedText, // Full text without limit
        },
        metadata: {
          textLength: selectedText?.length || 0,
        },
      });
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      // Get pasted text from clipboard
      const pastedText = e.clipboardData?.getData('text');

      logEvent({
        eventType: 'keyboard',
        action: 'paste',
        target: {
          element,
          section,
          text: pastedText, // Full text without limit
        },
        metadata: {
          textLength: pastedText?.length || 0,
        },
      });
    };

    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);
      const selectedText = window.getSelection()?.toString();

      logEvent({
        eventType: 'keyboard',
        action: 'cut',
        target: {
          element,
          section,
          text: selectedText, // Full text without limit
        },
        metadata: {
          textLength: selectedText?.length || 0,
        },
      });
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('cut', handleCut);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('cut', handleCut);
    };
  }, [logEvent]);

  /**
   * Text selection tracking
   */
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();

      // Check if selection is collapsed (no text selected)
      if (!selection || selection.isCollapsed) {
        // Only log selection_clear if there was a previous active selection
        if (hasActiveSelectionRef.current) {
          logEvent({
            eventType: 'selection',
            action: 'selection_clear',
          });
          hasActiveSelectionRef.current = false;
        }
        return;
      }

      const selectedText = selection.toString();
      if (!selectedText || selectedText.trim().length === 0) return;

      const range = selection.getRangeAt(0);
      const startContainer = range.startContainer;
      const element = startContainer.parentElement;
      const section = element ? getSectionFromElement(element) : undefined;
      const elementId = element ? getElementIdentifier(element) : undefined;

      // Mark that we have an active selection
      hasActiveSelectionRef.current = true;

      logEvent({
        eventType: 'selection',
        action: 'text_select',
        target: {
          element: elementId,
          section,
        },
        metadata: {
          selectedText: selectedText, // Full text without limit
          textLength: selectedText.length,
          startOffset: range.startOffset,
          endOffset: range.endOffset,
        },
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [logEvent]);

  /**
   * Drag and drop tracking
   */
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      logEvent({
        eventType: 'mouse',
        action: 'drag_start',
        target: {
          element,
          section,
          coordinates: { x: e.clientX, y: e.clientY },
        },
      });
    };

    const handleDragEnd = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      logEvent({
        eventType: 'mouse',
        action: 'drag_end',
        target: {
          element,
          section,
          coordinates: { x: e.clientX, y: e.clientY },
        },
      });
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, [logEvent]);

  /**
   * Text insert/delete tracking (Global for all input/textarea elements)
   */
  useEffect(() => {
    const handleInput = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;

      // Only track input and textarea elements
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

      const currentValue = target.value;
      const previousValue = inputValuesRef.current.get(target) || '';
      const section = getSectionFromElement(target);
      const element = getElementIdentifier(target);

      // Calculate the difference
      const currentLength = currentValue.length;
      const previousLength = previousValue.length;
      const lengthDiff = currentLength - previousLength;

      if (lengthDiff !== 0) {
        const isInsert = lengthDiff > 0;
        const metadata: Record<string, any> = {
          charsDelta: Math.abs(lengthDiff),
          newLength: currentLength,
          previousLength: previousLength,
        };

        // For deletions, try to capture what was deleted
        if (!isInsert) {
          // Find where the deletion occurred
          let deletionStart = 0;
          for (let i = 0; i < Math.min(currentLength, previousLength); i++) {
            if (currentValue[i] !== previousValue[i]) {
              deletionStart = i;
              break;
            }
          }

          // If all matching characters are at the start, deletion is at the end
          if (deletionStart === 0 && currentLength < previousLength) {
            deletionStart = currentLength;
          }

          const deletedText = previousValue.substring(deletionStart, deletionStart + Math.abs(lengthDiff));
          metadata.deletedText = deletedText; // Full text without limit
        }

        // For insertions, capture what was inserted
        if (isInsert) {
          // Find where the insertion occurred
          let insertionStart = 0;
          for (let i = 0; i < Math.min(currentLength, previousLength); i++) {
            if (currentValue[i] !== previousValue[i]) {
              insertionStart = i;
              break;
            }
          }

          const insertedText = currentValue.substring(insertionStart, insertionStart + lengthDiff);
          metadata.insertedText = insertedText; // Full text without limit
        }

        logEvent({
          eventType: 'keyboard',
          action: isInsert ? 'text_insert' : 'text_delete',
          target: {
            element,
            section,
          },
          metadata,
        });
      }

      // Update stored value
      inputValuesRef.current.set(target, currentValue);
    };

    const handleFocus = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;

      // Only track input and textarea elements
      if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

      // Initialize value on focus
      inputValuesRef.current.set(target, target.value);
    };

    // Listen to input events on all input/textarea elements
    document.addEventListener('input', handleInput, true);
    document.addEventListener('focus', handleFocus, true);

    return () => {
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('focus', handleFocus, true);
      inputValuesRef.current.clear();
    };
  }, [logEvent]);

  return {
    logEvent,
    sendBatch, // Manual batch send if needed
  };
};

/**
 * Helper function to identify which section of the UI an element belongs to
 */
function getSectionFromElement(element: HTMLElement | null): Section | undefined {
  if (!element) return undefined;

  // Traverse up to find section
  let current: HTMLElement | null = element;
  while (current) {
    // Safely get className as string (handles SVG elements)
    const classes = typeof current.className === 'string' ? current.className : '';

    if (classes.includes('section-chat')) return 'prompting';
    if (classes.includes('section-transcript')) return 'transcript';
    if (classes.includes('section-writing')) return 'writing';
    if (current.tagName === 'ARTICLE' && current.getAttribute('data-turn')) return 'response';

    current = current.parentElement;
  }

  return undefined;
}

/**
 * Helper function to get a meaningful identifier for an element
 * Walks up the DOM tree if the element is an SVG to find the parent button
 */
function getElementIdentifier(element: HTMLElement | null): string {
  if (!element || !element.tagName) return 'unknown';

  // If clicking on SVG or path inside a button, traverse up to find the button
  let current: HTMLElement | null = element;
  let depth = 0;
  const maxDepth = 3; // Don't traverse too far up

  while (current && depth < maxDepth) {
    const tagName = current.tagName.toLowerCase();

    // If we hit a button or link, use that element's identifier
    if (tagName === 'button' || tagName === 'a' || current.getAttribute('role') === 'button') {
      // Priority: data-testid > aria-label > id > class > tag
      if (current.dataset?.testid) return `[data-testid="${current.dataset.testid}"]`;
      if (current.getAttribute('aria-label')) return `[aria-label="${current.getAttribute('aria-label')}"]`;
      if (current.id) return `#${current.id}`;

      if (current.className && typeof current.className === 'string') {
        const classList = current.className.split(' ').filter(c => c.length > 0);
        if (classList.length > 0) {
          return `${tagName}.${classList[0]}`;
        }
      }
      return tagName;
    }

    current = current.parentElement;
    depth++;
  }

  // If not inside a button, use the original element
  // Priority: data-testid > id > aria-label > placeholder > class > tag
  if (element.dataset?.testid) return `[data-testid="${element.dataset.testid}"]`;
  if (element.id) return `#${element.id}`;
  if (element.getAttribute('aria-label')) return `[aria-label="${element.getAttribute('aria-label')}"]`;

  // Special handling for placeholder with messageId
  const placeholder = element.getAttribute('placeholder');
  const messageId = element.getAttribute('data-message-id');
  if (placeholder && messageId) {
    return `[placeholder="${placeholder}", messageId="${messageId}"]`;
  }
  if (placeholder) return `[placeholder="${placeholder}"]`;

  const tagName = element.tagName.toLowerCase();
  if (element.className && typeof element.className === 'string') {
    const classList = element.className.split(' ').filter(c => c.length > 0);
    if (classList.length > 0) {
      return `${tagName}.${classList[0]}`;
    }
  }

  return tagName;
}

/**
 * Helper function to determine if an element is interactive
 */
function isInteractiveElement(element: HTMLElement | null): boolean {
  if (!element || !element.tagName) return false;

  const tagName = element.tagName.toLowerCase();
  const interactiveTags = ['button', 'a', 'input', 'textarea', 'select', 'label'];

  return (
    interactiveTags.includes(tagName) ||
    element.hasAttribute('data-testid') ||
    element.onclick !== null ||
    element.getAttribute('role') === 'button' ||
    element.style.cursor === 'pointer'
  );
}

/**
 * Helper function to extract button information (text and hover message)
 * Traverses up to find the button element if clicking on child elements (like SVG)
 */
function getButtonInfo(element: HTMLElement | null): Record<string, any> {
  if (!element) return {};

  // Traverse up to find a button element
  let current: HTMLElement | null = element;
  let depth = 0;
  const maxDepth = 3;

  while (current && depth < maxDepth) {
    const tagName = current.tagName.toLowerCase();

    // If we found a button or button-like element
    if (tagName === 'button' || tagName === 'a' || current.getAttribute('role') === 'button') {
      const info: Record<string, any> = {};

      // Get visible button text (innerText strips formatting and gets displayed text)
      const buttonText = current.innerText?.trim();
      if (buttonText && buttonText.length > 0 && buttonText.length < 200) {
        info.buttonText = buttonText;
      }

      // Get hover message from title or aria-label attributes
      const title = current.getAttribute('title');
      const ariaLabel = current.getAttribute('aria-label');

      if (title) {
        info.buttonHoverMessage = title;
      } else if (ariaLabel) {
        info.buttonHoverMessage = ariaLabel;
      }

      // Get button value or type if applicable
      if (current instanceof HTMLButtonElement) {
        if (current.value) {
          info.buttonValue = current.value;
        }
        if (current.type && current.type !== 'button') {
          info.buttonType = current.type;
        }
      }

      return info;
    }

    current = current.parentElement;
    depth++;
  }

  // If not a button, return empty object
  return {};
}

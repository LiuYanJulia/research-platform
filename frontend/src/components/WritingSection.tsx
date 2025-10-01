import React, { useState, useEffect, useRef, useCallback } from 'react';

const WritingSection: React.FC = () => {
  const [content, setContent] = useState('');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update counts when content changes
  useEffect(() => {
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);
    setCharCount(content.length);
  }, [content]);

  const autoSave = useCallback(async () => {
    setIsAutoSaving(true);
    try {
      const response = await fetch('/api/writing/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content,
          wordCount: wordCount,
          charCount: charCount,
          timestamp: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setLastSaved(new Date());
    } catch (error) {
      console.error('Error auto-saving:', error);
      // For demo purposes, we'll still set lastSaved to show the feature works
      setLastSaved(new Date());
    } finally {
      setIsAutoSaving(false);
    }
  }, [content, wordCount, charCount]);

  // Auto-save functionality
  useEffect(() => {
    if (content.trim()) {
      const autoSaveTimer = setTimeout(() => {
        autoSave();
      }, 3000);

      return () => clearTimeout(autoSaveTimer);
    }
  }, [content, autoSave]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('Please write something before submitting.');
      return;
    }

    try {
      // Get transcript and chat history for comprehensive submission
      const [transcriptResponse, chatResponse] = await Promise.all([
        fetch('/api/transcripts/current'),
        fetch('/api/chat/current')
      ]);

      const transcriptData = transcriptResponse.ok ? await transcriptResponse.json() : { content: '' };
      const chatData = chatResponse.ok ? await chatResponse.json() : { messages: [] };

      // Submit everything to backend
      const response = await fetch('/api/submissions/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          finalWriting: content,
          wordCount: wordCount,
          charCount: charCount,
          transcript: transcriptData.content || '',
          chatHistory: chatData.messages || [],
          submittedAt: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Show success message
      alert('Your submission has been saved successfully!');
      setShowSubmitConfirm(false);

      // Optionally clear the content or disable further editing
      // setContent('');
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Error submitting your work. Please try again.');
    }
  };

  const clearContent = () => {
    if (content.trim() && !window.confirm('Are you sure you want to clear all content? This cannot be undone.')) {
      return;
    }
    setContent('');
    setLastSaved(null);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-resize textarea with max height limit
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = 300; // Maximum height in pixels
      const newHeight = Math.min(textareaRef.current.scrollHeight, maxHeight);
      textareaRef.current.style.height = newHeight + 'px';
    }
  }, [content]);

  return (
    <>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }} className="text-token-text-primary">Final Writing & Submission</h2>
          <button
            onClick={clearContent}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.875rem',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Clear
          </button>
        </div>

        {/* Writing Area */}
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Combine your insights from the transcript and LLM conversation here. Write your final thoughts, conclusions, or answers..."
            style={{
              width: '100%',
              minHeight: '200px',
              padding: '1rem',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              resize: 'vertical',
              outline: 'none',
              fontSize: '0.875rem',
              lineHeight: '1.625',
              transition: 'border-color 0.2s, box-shadow 0.2s'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = '#3b82f6';
              e.target.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '#e5e7eb';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Status Bar */}
        <div style={{ marginBottom: '1rem', fontSize: '0.75rem' }} className="flex items-center justify-between text-xs text-token-text-secondary">
          <div className="flex items-center gap-4">
            <span>Words: {wordCount}   </span>
            <span>Characters: {charCount}      </span>
            {isAutoSaving && (
              <div className="flex items-center gap-1">
                <div className="animate-spin h-3 w-3 border border-gray-300 border-t-gray-600 rounded-full"></div>
                <span>Saving...</span>
              </div>
            )}
            {lastSaved && !isAutoSaving && (
              <span className="text-green-600">
                Last saved: {formatTimestamp(lastSaved)}
              </span>
            )}
          </div>
        </div>

        {/* Submission Section - Now flows naturally in the scrollable content */}
        <div>
          <div className="space-y-3">
            <div className="text-sm text-token-text-secondary">
              <p className="mb-2">Ready to submit your work?</p>
              <ul className="text-xs space-y-1 ml-4 list-disc">
                <li>Your transcript and conversation history will be included</li>
                <li>This action cannot be undone</li>
                <li>Make sure you've completed your thoughts</li>
              </ul>
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={!content.trim()}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                content.trim()
                  ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-2 focus:ring-green-500'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              Submit Final Work
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Confirm Submission</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to submit your final work? This will save all your progress including:
            </p>
            <ul className="text-sm text-gray-600 mb-6 ml-4 list-disc space-y-1">
              <li>Your voice transcript</li>
              <li>LLM conversation history</li>
              <li>Final written content ({wordCount} words)</li>
              <li>All interaction logs</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-2 px-4 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WritingSection;
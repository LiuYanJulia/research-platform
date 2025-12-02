import React, { useState, useRef } from 'react';
import ChatInterface from '../components/ChatInterface';
import WebRTCTranscript, { WebRTCTranscriptRef } from '../components/WebRTCTranscript';
import WritingSection from '../components/WritingSection';
import Timer from '../components/Timer';
import { useInteractionLogger } from '../hooks/useInteractionLogger';
import '../App.css';

interface ResearchPagePracticeProps {
  sessionId: string;
  sessionStartTime: number;
  onComplete: () => void;
}

const ResearchPagePractice: React.FC<ResearchPagePracticeProps> = ({
  sessionId,
  sessionStartTime,
  onComplete
}) => {
  // Initialize logger only when this page is mounted (for practice session)
  const logger = useInteractionLogger({
    sessionId: sessionId,
    sessionStartTime: sessionStartTime,
    batchSize: 50,
    batchInterval: 5000,
  });
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const transcriptRef = useRef<WebRTCTranscriptRef>(null);

  // Auto-start recording when page loads
  React.useEffect(() => {
    if (transcriptRef.current) {
      setTimeout(() => {
        console.log('Auto-starting recording for practice session...');
        transcriptRef.current?.startRecording();
      }, 1000);
    }
  }, []);

  const handleTimerExpire = () => {
    // Stop recording when practice time is up
    if (transcriptRef.current) {
      console.log('[Practice] Stopping recording due to timer expiration');
      transcriptRef.current.stopRecording();
    }

    // Show modal
    setShowCompleteModal(true);
  };

  const handleContinue = () => {
    // Validate password (case-sensitive)
    if (password !== 'Continue') {
      setPasswordError('Incorrect password. Please try again.');
      return;
    }

    // CRITICAL: Ensure recording is fully stopped before navigating
    if (transcriptRef.current) {
      console.log('[Practice] Ensuring recording stopped before navigation');
      transcriptRef.current.stopRecording();
    }

    setShowCompleteModal(false);

    // Give a brief delay to ensure cleanup completes before unmounting
    setTimeout(() => {
      onComplete();
    }, 100);
  };

  // Cleanup on unmount - ensure session is terminated
  React.useEffect(() => {
    // Capture ref value in the effect scope
    const currentTranscriptRef = transcriptRef.current;
    return () => {
      console.log('[Practice] Component unmounting - stopping recording');
      if (currentTranscriptRef) {
        currentTranscriptRef.stopRecording();
      }
    };
  }, []);

  return (
    <>
      {/* Timer - countdown 2 minutes, visible */}
      <Timer
        mode="countdown"
        initialSeconds={120}
        visible={true}
        onExpire={handleTimerExpire}
      />

      <div className="main-grid bg-token-bg-primary text-token-text-primary">
        {/* LLM Chat Interface - Left Half */}
        <div className="section-chat border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
          <ChatInterface
            sessionId={sessionId}
            sessionStartTime={sessionStartTime}
            logger={logger}
          />
        </div>

        {/* Right Half - Transcript and Writing */}
        <div className="section-right">
          {/* Voice Transcript Section - Top Right */}
          <div className="section-transcript border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
            <WebRTCTranscript
              ref={transcriptRef}
              isPracticeMode={true}
            />
          </div>

          {/* Final Writing/Submission Section - Bottom Right */}
          <div className="section-writing border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
            <WritingSection
              sessionId={sessionId}
              transcriptRef={transcriptRef}
              sessionStartTime={sessionStartTime}
              logger={logger}
              isPracticeMode={true}
              taskDescription="Toy"
            />
          </div>
        </div>
      </div>

      {/* Practice Complete Modal */}
      {showCompleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '0.5rem',
            padding: '2rem',
            maxWidth: '28rem',
            width: '100%',
            margin: '0 1rem'
          }}>
            <div style={{
              textAlign: 'center',
              marginBottom: '1.5rem'
            }}>
              <svg
                style={{
                  margin: '0 auto 1rem',
                  width: '3rem',
                  height: '3rem',
                  color: '#10b981'
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '0.5rem'
              }}>
                Practice Task Complete
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '1rem'
              }}>
                Time's up, practice finished. Research team will come and check again. Please stay at this page. You need a password to continue with the main task.
              </p>
            </div>

            {/* Password Input */}
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="text"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(''); // Clear error when typing
                }}
                placeholder="Enter password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: passwordError ? '2px solid #ef4444' : '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  if (!passwordError) {
                    e.currentTarget.style.borderColor = '#10b981';
                  }
                }}
                onBlur={(e) => {
                  if (!passwordError) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }
                }}
              />
              {passwordError && (
                <p style={{
                  marginTop: '0.5rem',
                  fontSize: '0.875rem',
                  color: '#ef4444'
                }}>
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={handleContinue}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
            >
              Continue to Main Task
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ResearchPagePractice;

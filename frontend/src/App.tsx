import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import InstructionPage from './components/InstructionPage';
import ChatInterface from './components/ChatInterface';
import WebRTCTranscript, { WebRTCTranscriptRef } from './components/WebRTCTranscript';
import WritingSection from './components/WritingSection';
import { useInteractionLogger } from './hooks/useInteractionLogger';

function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionStartTime, setSessionStartTime] = useState<number>(0);
  const transcriptRef = useRef<WebRTCTranscriptRef>(null);

  // Initialize logger ONCE at the App level (not in individual components)
  // This prevents duplicate logging since global event listeners are attached once
  const logger = useInteractionLogger({
    sessionId: sessionId || '',
    sessionStartTime: sessionStartTime || Date.now(),
    batchSize: 50,
    batchInterval: 5000,
  });

  const handleAgree = async () => {
    // Generate unique session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Record session start time (milliseconds since epoch)
    const startTime = Date.now();
    setSessionStartTime(startTime);

    try {
      // Create session in database
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: newSessionId,
          participantId: 'participant_' + Date.now() // You can customize this
        }),
      });

      if (!response.ok) {
        console.error('Failed to create session in database');
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }

    setSessionId(newSessionId);
    setSessionStarted(true);
  };

  // Auto-start recording when session starts
  useEffect(() => {
    if (sessionStarted && transcriptRef.current) {
      // Small delay to ensure component is mounted
      setTimeout(() => {
        console.log('Auto-starting recording...');
        transcriptRef.current?.startRecording();
      }, 1000);
    }
  }, [sessionStarted]);

  if (!sessionStarted) {
    return <InstructionPage onAgree={handleAgree} />;
  }

  return (
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
          <WebRTCTranscript ref={transcriptRef} />
        </div>

        {/* Final Writing/Submission Section - Bottom Right */}
        <div className="section-writing border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
          <WritingSection
            sessionId={sessionId}
            transcriptRef={transcriptRef}
            sessionStartTime={sessionStartTime}
            logger={logger}
          />
        </div>
      </div>
    </div>
  );
}

export default App;

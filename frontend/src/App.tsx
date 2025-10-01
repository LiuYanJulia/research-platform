import React, { useState, useEffect } from 'react';
import './App.css';
import InstructionPage from './components/InstructionPage';
import ChatInterface from './components/ChatInterface';
import WebRTCTranscript from './components/WebRTCTranscript';
import WritingSection from './components/WritingSection';

function App() {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  const handleAgree = () => {
    // Generate unique session ID
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    setSessionStarted(true);
  };

  if (!sessionStarted) {
    return <InstructionPage onAgree={handleAgree} />;
  }

  return (
    <div className="main-grid bg-token-bg-primary text-token-text-primary">
      {/* LLM Chat Interface - Left Half */}
      <div className="section-chat border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
        <ChatInterface sessionId={sessionId} />
      </div>

      {/* Right Half - Transcript and Writing */}
      <div className="section-right">
        {/* Voice Transcript Section - Top Right */}
        <div className="section-transcript border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
          <WebRTCTranscript />
        </div>

        {/* Final Writing/Submission Section - Bottom Right */}
        <div className="section-writing border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
          <WritingSection />
        </div>
      </div>
    </div>
  );
}

export default App;

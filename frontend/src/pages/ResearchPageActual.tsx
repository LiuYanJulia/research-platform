import React, { useState, useRef, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import WebRTCTranscript, { WebRTCTranscriptRef } from '../components/WebRTCTranscript';
import WritingSection from '../components/WritingSection';
import Timer from '../components/Timer';
import SubmissionConfirmation from '../components/SubmissionConfirmation';
import { useInteractionLogger } from '../hooks/useInteractionLogger';
import '../App.css';

interface ResearchPageActualProps {
  sessionId: string;
  sessionStartTime: number;
}

const ResearchPageActual: React.FC<ResearchPageActualProps> = ({
  sessionId,
  sessionStartTime
}) => {
  // Initialize logger only when this page is mounted
  const logger = useInteractionLogger({
    sessionId: sessionId,
    sessionStartTime: sessionStartTime,
    batchSize: 50,
    batchInterval: 5000,
  });
  const [submissionComplete, setSubmissionComplete] = useState(false);
  const transcriptRef = useRef<WebRTCTranscriptRef>(null);
  const elapsedSecondsRef = useRef(0);

  // Auto-start recording when page loads
  useEffect(() => {
    if (transcriptRef.current) {
      // Longer delay to ensure practice session is fully cleaned up
      setTimeout(() => {
        console.log('[Actual] Auto-starting recording for main task...');
        transcriptRef.current?.startRecording();
      }, 500);
    }
  }, []);

  // Cleanup on unmount - ensure session is terminated
  useEffect(() => {
    // Capture ref value in the effect scope
    const currentTranscriptRef = transcriptRef.current;
    return () => {
      console.log('[Actual] Component unmounting - stopping recording');
      if (currentTranscriptRef) {
        currentTranscriptRef.stopRecording();
      }
    };
  }, []);

  const handleTimerTick = React.useCallback((seconds: number) => {
    elapsedSecondsRef.current = seconds;
  }, []);

  const handleSubmissionComplete = async () => {
    // Stop recording when submission is complete
    if (transcriptRef.current) {
      transcriptRef.current.stopRecording();
    }

    // Try to send any remaining logs (but don't block if it fails)
    try {
      await logger.sendBatch();
    } catch (error) {
      console.warn('Failed to send final log batch, but submission will continue:', error);
    }

    // Show confirmation page
    setSubmissionComplete(true);
  };

  if (submissionComplete) {
    return <SubmissionConfirmation />;
  }

  return (
    <>
      {/* Timer - count up, hidden (only for tracking) */}
      <Timer
        mode="countup"
        visible={false}
        onTick={handleTimerTick}
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
              isPracticeMode={false}
            />
          </div>

          {/* Final Writing/Submission Section - Bottom Right */}
          <div className="section-writing border border-gray-200 rounded-lg p-4 bg-token-bg-primary">
            <WritingSection
              sessionId={sessionId}
              transcriptRef={transcriptRef}
              sessionStartTime={sessionStartTime}
              logger={logger}
              isPracticeMode={false}
              elapsedTimeRef={elapsedSecondsRef}
              onSubmissionComplete={handleSubmissionComplete}
              taskDescription="Adult Learning Platform"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ResearchPageActual;

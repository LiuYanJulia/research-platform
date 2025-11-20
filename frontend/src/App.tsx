import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import './App.css';
import UserIdEntry from './components/UserIdEntry';
import WelcomePractice from './components/WelcomePractice';
import WelcomeActual from './components/WelcomeActual';
import ResearchPagePractice from './pages/ResearchPagePractice';
import ResearchPageActual from './pages/ResearchPageActual';

function AppContent() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string>('');
  const [practiceSessionId, setPracticeSessionId] = useState<string>('');
  const [actualSessionId, setActualSessionId] = useState<string>('');
  const [practiceSessionStartTime, setPracticeSessionStartTime] = useState<number>(0);
  const [actualSessionStartTime, setActualSessionStartTime] = useState<number>(0);

  // Handle user ID submission
  const handleUserIdSubmit = async (submittedUserId: string) => {
    setUserId(submittedUserId);

    // Generate practice session ID
    const practiceId = `practice_${submittedUserId}_${Date.now()}`;
    setPracticeSessionId(practiceId);
    setPracticeSessionStartTime(Date.now());

    try {
      // Create practice session in database immediately
      await fetch('/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: practiceId,
          participantId: submittedUserId
        }),
      });
    } catch (error) {
      console.error('Error creating practice session:', error);
    }

    // Navigate to practice welcome page
    navigate('/welcome-practice');
  };

  // Handle start practice task
  const handleStartPractice = () => {
    navigate('/practice');
  };

  // Handle practice complete
  const handlePracticeComplete = () => {
    navigate('/welcome-actual');
  };

  // Handle start actual task
  const handleStartActual = async () => {
    // Generate actual session ID
    const actualId = `${userId}_${Date.now()}`;
    const startTime = Date.now();

    setActualSessionId(actualId);
    setActualSessionStartTime(startTime);

    try {
      // Create session in database
      await fetch('/api/session/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: actualId,
          participantId: userId
        }),
      });
    } catch (error) {
      console.error('Error creating session:', error);
    }

    navigate('/research');
  };

  return (
    <Routes>
      <Route path="/" element={<UserIdEntry onSubmit={handleUserIdSubmit} />} />
      <Route path="/welcome-practice" element={<WelcomePractice onStart={handleStartPractice} />} />
      <Route
        path="/practice"
        element={
          <ResearchPagePractice
            sessionId={practiceSessionId}
            sessionStartTime={practiceSessionStartTime}
            onComplete={handlePracticeComplete}
          />
        }
      />
      <Route path="/welcome-actual" element={<WelcomeActual onStart={handleStartActual} />} />
      <Route
        path="/research"
        element={
          <ResearchPageActual
            sessionId={actualSessionId}
            sessionStartTime={actualSessionStartTime}
          />
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;

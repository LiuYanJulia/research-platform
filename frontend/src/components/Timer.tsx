import React, { useState, useEffect, useRef } from 'react';

interface TimerProps {
  mode: 'countdown' | 'countup';
  initialSeconds?: number; // For countdown mode, starting seconds (e.g., 120 for 2 minutes)
  visible?: boolean; // Whether to display the timer visually
  onExpire?: () => void; // Callback when countdown reaches 0
  onTick?: (elapsedSeconds: number) => void; // Callback on each second (for countup mode)
}

const Timer: React.FC<TimerProps> = ({
  mode,
  initialSeconds = 120,
  visible = true,
  onExpire,
  onTick
}) => {
  const [seconds, setSeconds] = useState(mode === 'countdown' ? initialSeconds : 0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start the timer
    intervalRef.current = setInterval(() => {
      setSeconds(prev => {
        if (mode === 'countdown') {
          const newValue = prev - 1;
          if (newValue <= 0) {
            // Timer expired
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            if (onExpire) {
              onExpire();
            }
            return 0;
          }
          return newValue;
        } else {
          // Count up mode
          const newValue = prev + 1;
          if (onTick) {
            onTick(newValue);
          }
          return newValue;
        }
      });
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [mode, onExpire, onTick]);

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number): string => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!visible) {
    return null; // Hidden timer for tracking purposes only
  }

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      backgroundColor: mode === 'countdown' ? '#fef3c7' : '#dbeafe',
      padding: '0.75rem 1.25rem',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    }}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={mode === 'countdown' ? '#f59e0b' : '#3b82f6'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{
        fontSize: '1.125rem',
        fontWeight: '600',
        color: mode === 'countdown' ? '#92400e' : '#1e40af'
      }}>
        {mode === 'countdown' ? 'Time Left: ' : 'Time: '}
        {formatTime(seconds)}
      </span>
    </div>
  );
};

export default Timer;

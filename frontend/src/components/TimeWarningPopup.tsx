import React from 'react';

interface TimeWarningPopupProps {
  onContinue: () => void;
}

const TimeWarningPopup: React.FC<TimeWarningPopupProps> = ({ onContinue }) => {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        padding: '2rem',
        maxWidth: '28rem',
        width: '90%',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      }}>
        <div style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          marginBottom: '1rem',
          textAlign: 'center',
          color: '#f59e0b'
        }}>
          ⏰ Time Reminder
        </div>

        <p style={{
          fontSize: '1.125rem',
          marginBottom: '1.5rem',
          textAlign: 'center',
          color: '#374151'
        }}>
          You have <strong>5 minutes</strong> remaining to complete your task.
        </p>

        <button
          onClick={onContinue}
          style={{
            width: '100%',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TimeWarningPopup;

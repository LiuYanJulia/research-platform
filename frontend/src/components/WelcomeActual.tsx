import React from 'react';

interface WelcomeActualProps {
  onStart: () => void;
}

const WelcomeActual: React.FC<WelcomeActualProps> = ({ onStart }) => {
  return (
    <div style={{
      minHeight: '100vh',
      height: '100vh',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '2rem',
      overflowY: 'auto',
      boxSizing: 'border-box'
    }} className="bg-token-bg-primary">
      <div style={{
        maxWidth: '42rem',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '2.5rem',
        margin: '2rem auto',
        flexShrink: 0
      }}>
        <h1 style={{
          fontSize: '1.875rem',
          fontWeight: '700',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }} className="text-token-text-primary">
          Main Design Task
        </h1>

        <div style={{
          fontSize: '1rem',
          lineHeight: '1.75',
          marginBottom: '2rem'
        }} className="text-token-text-secondary">
          <p style={{ marginBottom: '1rem' }}>
            You will now begin the main experiment. Please take your time and engage thoughtfully with the task.
          </p>

          <div style={{
            backgroundColor: '#f3f4f6',
            padding: '1.5rem',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: '600',
              marginBottom: '1rem'
            }} className="text-token-text-primary">
              Your Task: Design a Platform for Adults to Learn
            </h2>
            <p style={{ marginBottom: '0.75rem' }}>
              Your task is to <strong>design a learning platform for adults</strong> and <strong>write down your product design proposal in the writing box on the right-hand side of the platform</strong>. Consider:
            </p>
            <ul style={{
              marginLeft: '1.5rem',
              listStyle: 'disc',
              marginBottom: '1rem'
            }}>
              <li>What types of learning experiences would be most effective?</li>
              <li>What features and functionality should the platform include?</li>
              <li>How would you address the unique needs of adult learners?</li>
              <li>What would make your platform engaging and easy to use?</li>
            </ul>
          </div>

          <h3 style={{
            fontSize: '1rem',
            fontWeight: '600',
            marginBottom: '0.75rem'
          }} className="text-token-text-primary">
            Requirements:
          </h3>
          <ul style={{
            marginLeft: '1.5rem',
            listStyle: 'disc',
            marginBottom: '1.5rem'
          }}>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Minimum Time:</strong> Please spend at least 10 minutes on this task
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Maximum Time:</strong> There is no maximum time limit - take as long as you need
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Verbalize Your Thoughts:</strong> Continue speaking out loud as you work
            </li>
            <li style={{ marginBottom: '0.5rem' }}>
              <strong>Use All Tools:</strong> Feel free to use the AI assistant and writing area, but please remain on this website throughout the entire process until you submit your final work
            </li>
          </ul>

        </div>

        <button
          onClick={onStart}
          style={{
            width: '100%',
            padding: '0.875rem 1.5rem',
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
          Start the Main Task
        </button>
      </div>
    </div>
  );
};

export default WelcomeActual;

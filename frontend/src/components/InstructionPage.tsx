import React from 'react';

interface InstructionPageProps {
  onAgree: () => void;
}

const InstructionPage: React.FC<InstructionPageProps> = ({ onAgree }) => {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb'
    }}>
      <div style={{
        maxWidth: '800px',
        width: '90%',
        backgroundColor: 'white',
        borderRadius: '1rem',
        padding: '3rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          marginBottom: '2rem',
          textAlign: 'center',
          color: '#1f2937'
        }}>
          Research Study Instructions
        </h1>

        <div style={{
          fontSize: '1rem',
          lineHeight: '1.75',
          color: '#4b5563',
          marginBottom: '2rem'
        }}>
          <p style={{ marginBottom: '1rem' }}>
            Welcome to the research platform. You will be designing the next year's iPhone (iPhone 18). Your goal is to create a comprehensive product design proposal. Throughout this study, you must continuously verbalize your thoughts out loud as you work on the design task. This study involves:
          </p>

          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
            <li style={{ marginBottom: '0.5rem' }}>Voice transcription of your thoughts</li>
            <li style={{ marginBottom: '0.5rem' }}>Interaction with an AI assistant</li>
            <li style={{ marginBottom: '0.5rem' }}>Writing and submitting your final responses</li>
          </ul>

          <p style={{ marginBottom: '1rem' }}>
            All data collected will be used for research purposes only and will be kept confidential.
          </p>

          <p style={{ marginBottom: '1rem' }}>
            By clicking "I agree and start", you consent to participate in this study.
          </p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onAgree}
            style={{
              padding: '1rem 3rem',
              fontSize: '1.125rem',
              fontWeight: '600',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s, transform 0.1s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2563eb';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#3b82f6';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            I agree and start
          </button>
        </div>
      </div>
    </div>
  );
};

export default InstructionPage;

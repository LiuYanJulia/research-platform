import React from 'react';

const SubmissionConfirmation: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: 'var(--token-bg-primary, #ffffff)',
      padding: '2rem'
    }}>
      <div style={{
        maxWidth: '600px',
        textAlign: 'center'
      }}>
        {/* Success Icon */}
        <div style={{ marginBottom: '2rem' }}>
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ margin: '0 auto' }}
          >
            <circle cx="40" cy="40" r="40" fill="#22c55e" fillOpacity="0.1"/>
            <circle cx="40" cy="40" r="32" fill="#22c55e"/>
            <path
              d="M28 40L36 48L52 32"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '600',
          marginBottom: '1rem',
          color: 'var(--token-text-primary, #2d333a)'
        }}>
          Thank You!
        </h1>

        {/* Message */}
        <p style={{
          fontSize: '1.125rem',
          lineHeight: '1.75',
          color: 'var(--token-text-secondary, #6b7280)',
          marginBottom: '2rem'
        }}>
          Great! We have received your submission. Thanks for your participation!
        </p>

        {/* Additional Info */}
        <div style={{
          backgroundColor: 'var(--token-bg-secondary, #f8f9fa)',
          borderRadius: '0.5rem',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <p style={{
            fontSize: '0.875rem',
            lineHeight: '1.625',
            color: 'var(--token-text-secondary, #6b7280)',
            margin: 0
          }}>
            We may contact selected participants for a short interview within 1 month.
          </p>
        </div>

        {/* Closing Message */}
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--token-text-tertiary, #9ca3af)'
        }}>
          You can now safely close this window.
        </p>
      </div>
    </div>
  );
};

export default SubmissionConfirmation;

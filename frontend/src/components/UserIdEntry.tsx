import React, { useState } from 'react';

interface UserIdEntryProps {
  onSubmit: (userId: string) => void;
}

const UserIdEntry: React.FC<UserIdEntryProps> = ({ onSubmit }) => {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedId = userId.trim();
    if (!trimmedId) {
      setError('Please enter a valid user ID');
      return;
    }

    // Basic validation: alphanumeric and underscores only
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedId)) {
      setError('User ID can only contain letters, numbers, and underscores');
      return;
    }

    setError('');
    onSubmit(trimmedId);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }} className="bg-token-bg-primary">
      <div style={{
        maxWidth: '28rem',
        width: '100%',
        backgroundColor: 'white',
        borderRadius: '0.5rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        padding: '2rem'
      }}>
        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: '700',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }} className="text-token-text-primary">
          Welcome to the Study
        </h1>

        <p style={{
          fontSize: '0.875rem',
          marginBottom: '1.5rem',
          textAlign: 'center'
        }} className="text-token-text-secondary">
          Please enter your unique participant ID to begin
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: '500',
              marginBottom: '0.5rem'
            }} className="text-token-text-primary">
              User ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setError('');
              }}
              placeholder="Enter your user ID"
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                outline: 'none'
              }}
              className="text-token-text-primary"
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
            {error && (
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#ef4444'
              }}>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{
              width: '100%',
              padding: '0.625rem 1rem',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          >
            Continue
          </button>
        </form>
      </div>
    </div>
  );
};

export default UserIdEntry;

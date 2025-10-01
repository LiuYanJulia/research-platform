import React, { useState, useRef, useEffect, useCallback } from 'react';

interface RealtimeSession {
  id: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
  expires_at: number;
}

const WebRTCTranscript: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);

  // Create session and establish WebRTC connection
  const createRealtimeSession = async () => {
    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');
      setError('');

      // Step 1: Create OpenAI Realtime session
      console.log('Creating OpenAI Realtime session...');
      const response = await fetch('/api/transcript/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const { session } = await response.json();
      sessionRef.current = session;
      console.log('Session created:', session.id);

      // Step 2: Set up WebRTC peer connection
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      peerConnectionRef.current = peerConnection;

      // Step 3: Set up data channel for receiving transcription
      const dataChannel = peerConnection.createDataChannel('transcript', {
        ordered: true,
      });

      dataChannelRef.current = dataChannel;

      dataChannel.onopen = () => {
        console.log('Data channel opened');
        setConnectionStatus('connected');

        // Send session update to enable input audio transcription
        dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: {
            input_audio_transcription: {
              model: 'whisper-1'
            }
          }
        }));
        console.log('Session update sent to enable transcription');
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message:', message);

          // Handle different transcription event types
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            console.log('Transcription completed:', message.transcript);
            setTranscript(prev => prev + ' ' + message.transcript);
          } else if (message.type === 'input_audio_buffer.speech_started') {
            console.log('Speech started');
          } else if (message.type === 'input_audio_buffer.speech_stopped') {
            console.log('Speech stopped');
          } else if (message.type === 'session.created') {
            console.log('Session created:', message);
          } else if (message.type === 'session.updated') {
            console.log('Session updated:', message);
          } else if (message.type === 'error') {
            console.error('OpenAI error:', message);
            setError(message.error?.message || 'Unknown error from OpenAI');
          } else {
            console.log('Other message:', message);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        setError('Data channel error occurred');
      };

      dataChannel.onclose = () => {
        console.log('Data channel closed');
        setConnectionStatus('disconnected');
      };

      // Step 4: Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Step 5: Add audio track to peer connection
      stream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Step 6: Create offer and set up connection
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Step 7: Connect to OpenAI Realtime API via WebRTC
      const realtimeUrl = `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`;

      const connectResponse = await fetch(realtimeUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.client_secret.value}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!connectResponse.ok) {
        throw new Error(`Failed to connect to WebRTC: ${connectResponse.status}`);
      }

      const answerSdp = await connectResponse.text();

      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      }));

      console.log('WebRTC connection established');
      setIsRecording(true);
      setIsConnecting(false);

    } catch (error) {
      console.error('Failed to create realtime session:', error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      cleanup();
    }
  };

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    setIsRecording(false);
    cleanup();
  }, []);

  const cleanup = useCallback(() => {
    // Close data channel
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setConnectionStatus('disconnected');
    sessionRef.current = null;
  }, []);

  const clearTranscript = () => {
    setTranscript('');
    setError('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return '#22c55e';
      case 'connecting': return '#f59e0b';
      default: return '#ef4444';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      default: return 'Disconnected';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }} className="text-token-text-primary">
          Voice Transcript - WebRTC Live
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor()
          }}></div>
          <span style={{ fontSize: '0.75rem', color: getStatusColor() }}>
            {getStatusText()}
          </span>
          <button
            onClick={clearTranscript}
            style={{
              padding: '0.25rem 0.75rem',
              fontSize: '0.875rem',
              backgroundColor: '#f3f4f6',
              color: '#6b7280',
              border: 'none',
              borderRadius: '0.25rem',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              marginLeft: '1rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Recording Controls */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={isRecording ? stopRecording : createRealtimeSession}
          disabled={isConnecting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: isConnecting ? 'not-allowed' : 'pointer',
            backgroundColor: isRecording ? '#ef4444' : '#22c55e',
            color: 'white',
            opacity: isConnecting ? '0.5' : '1',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isConnecting) {
              e.currentTarget.style.backgroundColor = isRecording ? '#dc2626' : '#16a34a';
            }
          }}
          onMouseLeave={(e) => {
            if (!isConnecting) {
              e.currentTarget.style.backgroundColor = isRecording ? '#ef4444' : '#22c55e';
            }
          }}
        >
          {isRecording ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="4" y="4" width="8" height="8" rx="1"/>
              </svg>
              Stop Live Recording
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="8" cy="8" r="6"/>
              </svg>
              {isConnecting ? 'Connecting...' : 'Start Live Recording'}
            </>
          )}
        </button>

        {isConnecting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="text-token-text-secondary">
            <div style={{
              width: '1rem',
              height: '1rem',
              border: '2px solid #d1d5db',
              borderTop: '2px solid #4b5563',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            Setting up WebRTC connection...
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          color: '#b91c1c',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      {/* Recording Status - Fixed height to prevent layout shift */}
      <div style={{
        height: isRecording ? '0' : '0',
        //marginBottom: isRecording ? '1rem' : '0',
        opacity: isRecording ? 1 : 0,
        transition: 'all 0.2s ease-in-out',
        overflow: 'hidden'
      }}>
        {/*
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem',
          height: '100%'
        }}>
          <div style={{
            height: '0.75rem',
            width: '0.75rem',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <span style={{ color: '#1e40af', fontSize: '0.875rem', fontWeight: '500' }}>
            WebRTC live transcription active - speak naturally
          </span>
        </div>
        */}
      </div>

      {/* Transcript Display */}
      <div style={{
        flex: '1',
        backgroundColor: '#f9fafb',
        borderRadius: '0.5rem',
        padding: '1rem',
        overflowY: 'auto',
        border: '1px solid #d1d5db',
        minHeight: '150px',
        maxHeight: '100%'
      }}>
        {transcript ? (
          <div style={{
            whiteSpace: 'pre-wrap',
            fontSize: '0.875rem',
            lineHeight: '1.625'
          }} className="text-token-text-primary">
            {transcript}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 0' }} className="text-token-text-secondary">
            <svg style={{
              margin: '0 auto 1rem',
              height: '3rem',
              width: '3rem',
              color: '#9ca3af'
            }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p style={{ fontSize: '0.875rem' }}>Click "Start Live Recording" to begin WebRTC live transcription</p>
            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              Direct WebRTC connection to OpenAI GPT-4o Realtime API
            </p>
          </div>
        )}
      </div>

      {/* Transcript Info */}
      {transcript && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.75rem' }} className="text-token-text-secondary">
          Words: {transcript.trim().split(/\s+/).filter(w => w.length > 0).length} |
          Characters: {transcript.length} |
          WebRTC Live Transcription via GPT-4o Realtime
        </div>
      )}

      {/* CSS for animations */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
};

export default WebRTCTranscript;
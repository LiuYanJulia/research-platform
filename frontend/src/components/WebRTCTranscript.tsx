import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

interface RealtimeSession {
  id: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
  expires_at: number;
}

export interface WebRTCTranscriptRef {
  startRecording: () => void;
  stopRecording: () => void;
  getAudioData: () => {
    audioBlob: Blob | null;
    transcriptWithTimestamps: Array<{text: string, timestamp: number}>;
    recordingStartTime: number;
  };
}

interface WebRTCTranscriptProps {
  isPracticeMode?: boolean;
}

const WebRTCTranscript = forwardRef<WebRTCTranscriptRef, WebRTCTranscriptProps>(({ isPracticeMode = false }, ref) => {
  const [isRecording, setIsRecording] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [transcript, setTranscript] = useState(''); // Used in backend API, not displayed in UI
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isConnecting, setIsConnecting] = useState(false); // Used for connection state management
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [error, setError] = useState<string>('');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const transcriptWithTimestampsRef = useRef<Array<{text: string, timestamp: number}>>([]);

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
            const transcriptText = message.transcript;
            setTranscript(prev => prev + ' ' + transcriptText);

            // Save with timestamp (milliseconds since recording started)
            const timestamp = Date.now() - recordingStartTimeRef.current;
            transcriptWithTimestampsRef.current.push({
              text: transcriptText,
              timestamp: timestamp
            });
            console.log(`Transcript saved with timestamp: ${timestamp}ms`);
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

      // Start recording audio for later save
      try {
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(1000); // Collect data every second
        mediaRecorderRef.current = mediaRecorder;
        recordingStartTimeRef.current = Date.now();
        console.log('Started audio recording for file save');
      } catch (recorderError) {
        console.error('Failed to start MediaRecorder:', recorderError);
      }

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

  const cleanup = useCallback(() => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

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

  const stopRecording = useCallback(() => {
    console.log('Stopping recording...');
    setIsRecording(false);
    cleanup();
  }, [cleanup]);

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

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    startRecording: createRealtimeSession,
    stopRecording: stopRecording,
    getAudioData: () => {
      // Create audio blob from chunks
      const audioBlob = audioChunksRef.current.length > 0
        ? new Blob(audioChunksRef.current, { type: 'audio/webm' })
        : null;

      return {
        audioBlob,
        transcriptWithTimestamps: transcriptWithTimestampsRef.current,
        recordingStartTime: recordingStartTimeRef.current
      };
    }
  }));

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '0.5rem' }}>
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor()
        }}></div>
        <span style={{ fontSize: '0.75rem', color: getStatusColor() }}>
          {getStatusText()}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.5rem',
          color: '#b91c1c',
          fontSize: '0.75rem'
        }}>
          {error}
        </div>
      )}

      {/* Recording Info - Show when recording is active */}
      {isRecording && (
        <div style={{
          marginTop: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '0.5rem'
        }}>
          <div style={{
            height: '0.5rem',
            width: '0.5rem',
            backgroundColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }}></div>
          <span style={{ color: '#1e40af', fontSize: '0.75rem', fontWeight: '500' }}>
            Audio recording active - speak naturally
          </span>
        </div>
      )}

      {/* CSS for animations */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}
      </style>
    </div>
  );
});

WebRTCTranscript.displayName = 'WebRTCTranscript';

export default WebRTCTranscript;
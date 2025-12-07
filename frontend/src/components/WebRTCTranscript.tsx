import React, { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';

interface RealtimeSession {
  id: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
  expires_at: number;
}

export interface TranscriptEntry {
  text: string;
  timestamp: number;  // When speech STARTED (ms since recording start) - for correct ordering
  receiveTimestamp: number;  // When we received the transcription (ms since recording start)
  itemId?: string | null;  // OpenAI's item_id for reference
  speechOrder: number;  // Order based on when speech started (correct chronological order)
}

export interface WebRTCTranscriptRef {
  startRecording: () => void;
  stopRecording: () => void;
  getAudioData: () => {
    audioBlob: Blob | null;
    transcriptWithTimestamps: Array<TranscriptEntry>;
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
  const transcriptWithTimestampsRef = useRef<Array<TranscriptEntry>>([]);
  const lastTranscriptRef = useRef<{text: string, timestamp: number} | null>(null);

  // Track speech start times for correct ordering
  // Key: item_id, Value: timestamp when speech started
  const speechStartTimesRef = useRef<Map<string, number>>(new Map());
  // Counter for speech order (incremented each time speech starts)
  const speechOrderCounterRef = useRef<number>(0);

  const sessionLabel = isPracticeMode ? '[WebRTC-Practice]' : '[WebRTC-Actual]';

  // Log component mount/unmount
  useEffect(() => {
    console.log(`${sessionLabel} Component mounted`);
    return () => {
      console.log(`${sessionLabel} Component unmounting - triggering cleanup`);
    };
  }, [sessionLabel]);

  // Create session and establish WebRTC connection
  const createRealtimeSession = async () => {
    try {
      console.log(`${sessionLabel} Starting new recording session...`);

      // CRITICAL: Check if there's already an active session
      if (peerConnectionRef.current || mediaRecorderRef.current) {
        console.warn(`${sessionLabel} Found existing session - cleaning up first`);
        cleanup();
        // Wait a bit for cleanup to complete
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      setIsConnecting(true);
      setConnectionStatus('connecting');
      setError('');

      // Step 1: Create OpenAI Realtime session
      console.log(`${sessionLabel} Creating OpenAI Realtime session...`);
      const response = await fetch('/api/transcript/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }

      const { session, model } = await response.json();
      sessionRef.current = session;
      console.log(`${sessionLabel} Session created:`, session.id, 'Model:', model);

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
        console.log(`${sessionLabel} Data channel opened`);
        setConnectionStatus('connected');

        // Send session update to enable input audio transcription with server VAD
        dataChannel.send(JSON.stringify({
          type: 'session.update',
          session: {
            input_audio_transcription: {
              model: 'whisper-1'
            },
            // Enable server-side VAD (Voice Activity Detection) to detect speech segments
            turn_detection: {
              type: 'server_vad',
              threshold: 0.5,
              prefix_padding_ms: 300,
              silence_duration_ms: 500
            },
            modalities: ['text']    // Only text, no audio output
          }
        }));
        console.log(`${sessionLabel} Session update sent - transcription with server VAD enabled, audio output disabled`);
      };

      dataChannel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Track when speech STARTS - this gives us the correct chronological order
          if (message.type === 'input_audio_buffer.speech_started') {
            const speechStartTime = Date.now() - recordingStartTimeRef.current;
            speechOrderCounterRef.current += 1;
            const currentOrder = speechOrderCounterRef.current;

            // Store the speech start time with current order as key (item_id comes later)
            // We'll use a temporary key based on order since item_id isn't available yet
            const tempKey = `pending_${currentOrder}`;
            speechStartTimesRef.current.set(tempKey, speechStartTime);

            console.log(`${sessionLabel} Speech started at ${speechStartTime}ms, order: ${currentOrder}`);
          }

          // Track when speech STOPS - we can now associate item_id with the speech
          if (message.type === 'input_audio_buffer.speech_stopped') {
            const itemId = message.item_id;
            if (itemId) {
              // Find the most recent pending speech start and associate it with this item_id
              const pendingKeys = Array.from(speechStartTimesRef.current.keys())
                .filter(k => k.startsWith('pending_'))
                .sort((a, b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]));

              if (pendingKeys.length > 0) {
                const oldestPendingKey = pendingKeys[0];
                const speechStartTime = speechStartTimesRef.current.get(oldestPendingKey);
                if (speechStartTime !== undefined) {
                  // Move from pending key to item_id key
                  speechStartTimesRef.current.delete(oldestPendingKey);
                  speechStartTimesRef.current.set(itemId, speechStartTime);
                  console.log(`${sessionLabel} Speech stopped, item_id: ${itemId}, started at: ${speechStartTime}ms`);
                }
              }
            }
          }

          // Handle transcription completion
          if (message.type === 'conversation.item.input_audio_transcription.completed') {
            const transcriptText = message.transcript;
            const receiveTimestamp = Date.now() - recordingStartTimeRef.current;
            const itemId = message.item_id;

            // Get the speech start time for this item (for correct ordering)
            const speechStartTime = itemId ? speechStartTimesRef.current.get(itemId) : null;

            console.log(`${sessionLabel} Transcription completed:`, transcriptText);
            console.log(`${sessionLabel} item_id: ${itemId}, speech started at: ${speechStartTime}ms, received at: ${receiveTimestamp}ms`);

            // Deduplication: Check if this is a duplicate of the last transcript
            const isDuplicate = lastTranscriptRef.current &&
              lastTranscriptRef.current.text === transcriptText &&
              Math.abs(lastTranscriptRef.current.timestamp - receiveTimestamp) < 1000; // Within 1 second

            if (!isDuplicate) {
              // Not a duplicate, save it
              setTranscript(prev => prev + ' ' + transcriptText);

              // Determine speech order based on when this speech actually started
              // If we have the speech start time, find its order; otherwise use receive order
              let speechOrder = transcriptWithTimestampsRef.current.length;
              if (speechStartTime !== undefined && speechStartTime !== null) {
                // Count how many existing entries have earlier speech start times
                const startTime = speechStartTime; // TypeScript narrowing
                speechOrder = transcriptWithTimestampsRef.current.filter(
                  entry => entry.timestamp < startTime
                ).length;
              }

              const entry: TranscriptEntry = {
                text: transcriptText,
                timestamp: speechStartTime ?? receiveTimestamp,  // Use speech start time if available
                receiveTimestamp: receiveTimestamp,
                itemId: itemId || null,
                speechOrder: speechOrder
              };

              transcriptWithTimestampsRef.current.push(entry);

              // Re-sort by timestamp (speech start time) to maintain correct order
              transcriptWithTimestampsRef.current.sort((a, b) => a.timestamp - b.timestamp);

              // Update speech order after sorting
              transcriptWithTimestampsRef.current.forEach((e, idx) => {
                e.speechOrder = idx;
              });

              console.log(`${sessionLabel} Transcript saved and sorted. Total count:`, transcriptWithTimestampsRef.current.length);

              // Update last transcript reference
              lastTranscriptRef.current = { text: transcriptText, timestamp: receiveTimestamp };

              // Clean up the speech start time entry
              if (itemId) {
                speechStartTimesRef.current.delete(itemId);
              }
            } else {
              console.log(`${sessionLabel} Duplicate transcript ignored`);
            }
          } else if (message.type === 'error') {
            console.error(`${sessionLabel} OpenAI error:`, message);
            setError(message.error?.message || 'Unknown error from OpenAI');
          }
          // Log other message types for debugging (but not the common ones)
          else if (!['session.created', 'session.updated', 'input_audio_buffer.speech_started', 'input_audio_buffer.speech_stopped', 'input_audio_buffer.committed', 'conversation.item.created', 'response.created', 'response.done'].includes(message.type)) {
            console.log(`${sessionLabel} Received message type:`, message.type);
          }
        } catch (error) {
          console.error(`${sessionLabel} Error parsing message:`, error);
        }
      };

      dataChannel.onerror = (error) => {
        console.error('Data channel error:', error);
        setError('Data channel error occurred');
      };

      dataChannel.onclose = () => {
        setConnectionStatus('disconnected');
      };

      // Step 4: Get user media (microphone)
      // Check if mediaDevices is available (requires HTTPS in production)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access requires HTTPS. Please use a secure connection.');
      }

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
        console.log(`${sessionLabel} Started audio recording for file save`);
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

      // Step 7: Connect to OpenAI Realtime API via backend proxy (CORS fix)
      const connectResponse = await fetch('/api/transcript/realtime-connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          model: model || 'gpt-realtime',
          clientSecret: session.client_secret.value
        }),
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

      console.log(`${sessionLabel} WebRTC connection established successfully`);
      setIsRecording(true);
      setIsConnecting(false);

    } catch (error) {
      console.error(`${sessionLabel} Failed to create realtime session:`, error);
      setError(error instanceof Error ? error.message : 'Failed to start recording');
      setIsConnecting(false);
      setConnectionStatus('disconnected');
      cleanup();
    }
  };

  const cleanup = useCallback(() => {
    console.log(`${sessionLabel} Cleaning up session...`);

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

    // Stop media stream (microphone)
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Reset deduplication reference
    lastTranscriptRef.current = null;

    setConnectionStatus('disconnected');
    sessionRef.current = null;
  }, [sessionLabel]);

  const stopRecording = useCallback(() => {
    console.log(`${sessionLabel} Stopping recording...`);
    setIsRecording(false);
    cleanup();
  }, [cleanup, sessionLabel]);

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
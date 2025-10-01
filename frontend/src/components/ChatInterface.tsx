import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  modelSlug?: string;
  isFeedback?: boolean; // Mark feedback messages
  feedbackType?: 'good' | 'bad'; // Track feedback state for each message
  isLoading?: boolean; // Track loading state for assistant messages
}

interface ChatInterfaceProps {
  sessionId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ sessionId }) => {
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentModel, setCurrentModel] = useState('gpt-3.5-turbo'); // Default fallback
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // TODO: Show toast notification
  };

  const regenerateResponse = async (messageId: string) => {
    // Find the assistant message to regenerate
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const assistantMessage = messages[messageIndex];
    if (assistantMessage.role !== 'assistant') return;

    // Find the previous user message (the prompt that generated this response)
    let userMessage = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMessage = messages[i];
        break;
      }
    }

    if (!userMessage) return;

    try {
      // Get conversation history up to the user message (excluding the old assistant response)
      const conversationHistory = messages.slice(0, messageIndex).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Call the chat API to regenerate response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: userMessage.content,
          conversationHistory: conversationHistory
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Create new assistant message
      const newAssistantMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message || 'Sorry, I encountered an error regenerating the response.',
        timestamp: new Date(),
        modelSlug: currentModel
      };

      // Replace the old assistant message with the new one
      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = newAssistantMessage;
      setMessages(updatedMessages);

      // Save the new response to database
      await saveChatMessage(newAssistantMessage);

    } catch (error) {
      console.error('Error regenerating response:', error);

      // Fallback regeneration
      const fallbackMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `Here's an alternative response: "${userMessage.content}" - I apologize, but I'm having trouble connecting to the server for regeneration.`,
        timestamp: new Date(),
        modelSlug: currentModel
      };

      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = fallbackMessage;
      setMessages(updatedMessages);

      await saveChatMessage(fallbackMessage);
    }
  };

  const handleFeedback = async (messageId: string, isGood: boolean) => {
    try {
      console.log('=== handleFeedback called ===');
      console.log('messageId:', messageId);
      console.log('isGood:', isGood);
      console.log('Current messages:', messages.map(m => ({ id: m.id, role: m.role, feedbackType: m.feedbackType })));

      // Find the message being rated
      const message = messages.find(msg => msg.id === messageId);
      if (!message) {
        console.log('ERROR: Message not found!');
        return;
      }

      console.log('Found message to update:', { id: message.id, currentFeedbackType: message.feedbackType });

      // Update the message with feedback type
      setMessages(prev => {
        const updated = prev.map(msg => {
          if (msg.id === messageId) {
            const newFeedbackType: 'good' | 'bad' = isGood ? 'good' : 'bad';
            console.log(`Updating message ${msg.id} feedbackType to:`, newFeedbackType);
            return { ...msg, feedbackType: newFeedbackType } as Message;
          }
          console.log(`Not updating message ${msg.id} (current feedbackType: ${msg.feedbackType})`);
          return msg;
        });
        console.log('After update:', updated.map(m => ({ id: m.id, feedbackType: m.feedbackType })));
        return updated;
      });

      // Create feedback message as a user message for backend
      const feedbackContent = isGood
        ? "The previous answer is good. You do not reply anything here."
        : "The previous answer is bad. You do not reply anything here.";

      // Save feedback message to database without displaying in frontend
      await fetch('/api/chat/save-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          role: 'user',
          content: feedbackContent,
          model: null,
          isFeedback: true
        }),
      });

      console.log(`Feedback sent for message ${messageId}: ${isGood ? 'positive' : 'negative'}`);

    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  const saveChatMessage = async (message: Message) => {
    try {
      await fetch('/api/chat/save-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionId,
          role: message.role,
          content: message.content,
          model: message.modelSlug || null
        }),
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/chat/history?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.messages.map((msg: any) => ({
          id: msg.messageId || msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          modelSlug: msg.modelSlug
        }));

        // Sort messages by timestamp to ensure proper conversation order
        loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        setMessages(loadedMessages);
        console.log(`Loaded ${loadedMessages.length} messages from chat history for session ${sessionId}`);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const loadModelInfo = async () => {
    try {
      const response = await fetch('/api/chat/model-info');
      if (response.ok) {
        const data = await response.json();
        setCurrentModel(data.model);
        console.log(`Using model: ${data.model}`);
      }
    } catch (error) {
      console.error('Error loading model info:', error);
    }
  };

  // Load chat history and model info on component mount or sessionId change
  useEffect(() => {
    if (sessionId) {
      loadChatHistory();
      loadModelInfo();
    }
  }, [sessionId]);

  const handleSend = async () => {
    if (prompt.trim()) {
      // Add user message
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: prompt,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Save user message to database
      await saveChatMessage(userMessage);

      const currentPrompt = prompt;
      setPrompt('');

      // Add loading message immediately
      const loadingMessageId = (Date.now() + 1).toString();
      const loadingMessage: Message = {
        id: loadingMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true
      };
      setMessages(prev => [...prev, loadingMessage]);

      // Auto-scroll to bottom of messages container only (not the entire page)
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);

      try {
        // Call the chat API
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: sessionId,
            message: userMessage.content,
            conversationHistory: messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const assistantMessage: Message = {
          id: loadingMessageId,
          role: 'assistant',
          content: data.message || 'Sorry, I encountered an error processing your request.',
          timestamp: new Date(),
          modelSlug: currentModel,
          isLoading: false
        };

        // Replace loading message with actual response
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMessageId ? assistantMessage : msg
        ));

        // Save assistant message to database
        await saveChatMessage(assistantMessage);
      } catch (error) {
        console.error('Error calling chat API:', error);

        // Fallback response for demo purposes
        const assistantMessage: Message = {
          id: loadingMessageId,
          role: 'assistant',
          content: `I'm having trouble connecting to the server right now. This is a mock response to: "${currentPrompt}". Please try again later.`,
          timestamp: new Date(),
          modelSlug: currentModel,
          isLoading: false
        };

        // Replace loading message with fallback response
        setMessages(prev => prev.map(msg =>
          msg.id === loadingMessageId ? assistantMessage : msg
        ));

        // Save fallback assistant message to database
        await saveChatMessage(assistantMessage);
      }
    }
  };

  const handleGenerateFromTranscript = async () => {
    try {
      // First, get the transcript from the transcript section
      const transcriptResponse = await fetch('/api/transcripts/current');

      if (!transcriptResponse.ok) {
        throw new Error('Failed to fetch transcript');
      }

      const transcriptData = await transcriptResponse.json();

      if (!transcriptData.content || transcriptData.content.trim() === '') {
        setPrompt("Please record some audio first to generate a prompt from your transcript.");
        return;
      }

      // Call the API to generate prompt from transcript
      const response = await fetch('/api/chat/generate-from-transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: transcriptData.content
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setPrompt(data.prompt || "Based on your transcript, what insights would you like to explore further?");

    } catch (error) {
      console.error('Error generating prompt from transcript:', error);

      // Fallback with mock generation
      const mockPrompts = [
        "Based on your transcript, what are the key themes you'd like to explore further?",
        "What insights from your transcript would you like to develop into a more detailed analysis?",
        "How can you connect the ideas mentioned in your transcript to broader concepts?",
        "What questions arise from the content you've transcribed?",
        "What aspects of your transcript need further clarification or explanation?"
      ];

      const randomPrompt = mockPrompts[Math.floor(Math.random() * mockPrompts.length)];
      setPrompt(randomPrompt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MessageBubble: React.FC<{ message: Message; turnIndex: number }> = ({ message, turnIndex }) => (
    <article
      className="text-token-text-primary group"
      data-turn-id={message.id}
      data-testid={`conversation-turn-${turnIndex}`}
      data-turn={message.role}
      style={{ width: '100%', outline: 'none' }}
    >
      <div style={{ fontSize: '1rem', margin: 'auto', paddingBottom: '1.5rem' }}>
        <div style={{
          maxWidth: '100%',
          margin: '0 auto',
          flex: '1',
          position: 'relative',
          display: 'flex',
          width: '100%',
          minWidth: '0',
          flexDirection: 'column'
        }} className="group/turn-messages">

          {/* Message Content */}
          <div style={{ display: 'flex', maxWidth: '100%', flexDirection: 'column', flexGrow: '1' }}>
            <div
              data-message-author-role={message.role}
              data-message-id={message.id}
              style={{
                minHeight: '2rem',
                position: 'relative',
                display: 'flex',
                width: '100%',
                flexDirection: 'column',
                gap: '0.5rem',
                textAlign: 'start',
                wordBreak: 'break-word',
                whiteSpace: 'normal'
              }}
            >
              {message.role === 'user' ? (
                /* User Message */
                <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                  <div className="user-message-bubble-color" style={{
                    position: 'relative',
                    borderRadius: '18px',
                    padding: '0.375rem 1rem',
                    maxWidth: '70%'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
                  </div>
                </div>
              ) : (
                /* Assistant Message */
                <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: '0.25rem' }}>
                  {message.isLoading ? (
                    /* Loading indicator */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0' }}>
                      <div style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        backgroundColor: '#9ca3af',
                        animation: 'pulse 1.5s ease-in-out infinite'
                      }}></div>
                      <div style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        backgroundColor: '#9ca3af',
                        animation: 'pulse 1.5s ease-in-out 0.2s infinite'
                      }}></div>
                      <div style={{
                        width: '0.5rem',
                        height: '0.5rem',
                        borderRadius: '50%',
                        backgroundColor: '#9ca3af',
                        animation: 'pulse 1.5s ease-in-out 0.4s infinite'
                      }}></div>
                    </div>
                  ) : (
                    <div className="markdown prose" style={{ width: '100%', wordBreak: 'break-word' }}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons (only for assistant messages and not loading) */}
          {message.role === 'assistant' && !message.isLoading && (
            <div style={{ display: 'flex', minHeight: '46px', justifyContent: 'flex-start' }}>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.25rem',
                userSelect: 'none'
              }}>
                {/* Copy Button */}
                <button
                  onClick={() => copyToClipboard(message.content)}
                  className="text-token-text-secondary"
                  style={{
                    borderRadius: '0.5rem',
                    padding: '0.25rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--token-bg-secondary, #f8f9fa)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  aria-label="Copy"
                  title="Copy"
                  data-testid="copy-turn-action-button"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                  </svg>
                </button>

                {/* Good Response Button - Hide if bad feedback given */}
                {message.feedbackType !== 'bad' && (
                  <button
                    onClick={() => handleFeedback(message.id, true)}
                    className={`text-token-text-secondary ${message.feedbackType === 'good' ? 'bg-token-bg-tertiary' : ''}`}
                    style={{
                      borderRadius: '0.5rem',
                      padding: '0.25rem',
                      border: 'none',
                      backgroundColor: message.feedbackType === 'good' ? 'var(--token-bg-tertiary, #e5e7eb)' : 'transparent',
                      cursor: message.feedbackType === 'good' ? 'default' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (message.feedbackType !== 'good') {
                        e.currentTarget.style.backgroundColor = 'var(--token-bg-secondary, #f8f9fa)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (message.feedbackType !== 'good') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    aria-label="Good response"
                    title="Good response"
                    aria-pressed={message.feedbackType === 'good'}
                    data-state={message.feedbackType ? 'closed' : undefined}
                    data-testid="good-response-turn-action-button"
                    disabled={message.feedbackType === 'good'}
                  >
                    {message.feedbackType === 'good' ? (
                      // Filled/solid icon when clicked
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10.4933 2.24145C10.6705 1.93631 11.0263 1.77698 11.3766 1.84591C12.9688 2.15921 13.9371 3.75763 13.4595 5.28453L12.7524 7.66797H14.0805C16.2694 7.66797 17.8591 9.71567 17.2831 11.7933L16.1515 15.7534C15.7576 17.1743 14.4458 18.16 12.9488 18.16L7.97157 18.16C7.0564 18.1583 6.31505 17.4278 6.31505 16.527V7.66797H6.93102C7.22884 7.66797 7.50382 7.38853 7.65157 7.13413L10.4933 2.24145Z"/>
                        <path d="M4.98959 7.66797C3.61457 7.66797 2.66748 8.80749 2.66748 10.1603V15.7534C2.66748 17.1062 3.61457 18.16 4.98959 18.16H5.4337C5.15125 17.6796 4.98959 17.1219 4.98959 16.527V7.66797Z"/>
                      </svg>
                    ) : (
                      // Outline icon when not clicked
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 10v12"/>
                        <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h3.5a2 2 0 0 1 2 2.5"/>
                      </svg>
                    )}
                  </button>
                )}

                {/* Bad Response Button - Hide if good feedback given */}
                {message.feedbackType !== 'good' && (
                  <button
                    onClick={() => handleFeedback(message.id, false)}
                    className={`text-token-text-secondary ${message.feedbackType === 'bad' ? 'bg-token-bg-tertiary' : ''}`}
                    style={{
                      borderRadius: '0.5rem',
                      padding: '0.25rem',
                      border: 'none',
                      backgroundColor: message.feedbackType === 'bad' ? 'var(--token-bg-tertiary, #e5e7eb)' : 'transparent',
                      cursor: message.feedbackType === 'bad' ? 'default' : 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      if (message.feedbackType !== 'bad') {
                        e.currentTarget.style.backgroundColor = 'var(--token-bg-secondary, #f8f9fa)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (message.feedbackType !== 'bad') {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                    aria-label="Bad response"
                    title="Bad response"
                    aria-pressed={message.feedbackType === 'bad'}
                    data-state={message.feedbackType ? 'closed' : undefined}
                    data-testid="bad-response-turn-action-button"
                    disabled={message.feedbackType === 'bad'}
                  >
                    {message.feedbackType === 'bad' ? (
                      // Filled/solid icon when clicked
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.6687 5.83304C12.6687 5.22006 12.6649 4.91019 12.6394 4.70413L12.6062 4.52542C12.4471 3.93179 12.0022 3.45922 11.4255 3.26272L11.3083 3.22757C11.0963 3.17075 10.8175 3.16507 9.99974 3.16507H8.0554C7.04558 3.16507 6.62456 3.17475 6.32982 3.26175L6.2097 3.30374C5.95005 3.41089 5.71908 3.57635 5.53392 3.78616L5.45677 3.87796C5.30475 4.0748 5.20336 4.33135 5.03392 4.91702L4.83763 5.6221L4.45677 7.01761C4.24829 7.78204 4.10326 8.31846 4.02318 8.73929C3.94374 9.15672 3.94298 9.39229 3.98119 9.56448L4.03587 9.75784C4.18618 10.1996 4.50043 10.5702 4.91771 10.7901L5.05052 10.8477C5.20009 10.9014 5.40751 10.9429 5.72533 10.9678C6.15231 11.0012 6.70771 11.002 7.49974 11.002C7.71076 11.002 7.90952 11.1018 8.0349 11.2715C8.14465 11.4201 8.18683 11.6067 8.15404 11.7862L8.13548 11.8623L7.34447 14.4326C7.01523 15.5033 7.71404 16.6081 8.81126 16.7813L11.5095 12.0606L11.5827 11.9405C11.8445 11.5461 12.2289 11.2561 12.6687 11.1094V5.83304Z"/>
                        <path d="M17.3318 8.33304C17.3318 8.97366 17.3364 9.43432 17.2615 9.82327L17.2234 9.98538C16.949 11.0094 16.1821 11.8233 15.1872 12.1621L14.9861 12.2237C14.5624 12.3372 14.0656 12.3321 13.3337 12.3321C13.0915 12.3321 12.8651 12.4453 12.7204 12.6348L12.6638 12.7198L9.74388 17.8301C9.61066 18.0631 9.35005 18.1935 9.08372 18.1602L8.70579 18.1123C6.75379 17.8682 5.49542 15.9213 6.07396 14.041L6.60033 12.3272C6.22861 12.3233 5.90377 12.3161 5.62083 12.294C5.18804 12.26 4.79914 12.1931 4.44701 12.0391L4.29857 11.9668C3.52688 11.5605 2.95919 10.8555 2.72533 10.0205L2.68333 9.85257C2.58769 9.42154 2.62379 8.97768 2.71654 8.49026C2.80865 8.00634 2.97082 7.41139 3.17357 6.668L3.55443 5.27249L3.74583 4.58011C3.9286 3.94171 4.10186 3.45682 4.40404 3.06546L4.53685 2.9053C4.85609 2.54372 5.25433 2.25896 5.70189 2.07425L5.93626 1.99222C6.49455 1.82612 7.15095 1.83499 8.0554 1.83499H12.6667C13.3558 1.83499 13.9128 1.83434 14.363 1.87112C14.8208 1.90854 15.2266 1.98789 15.6033 2.17972L15.821 2.30179C16.317 2.6059 16.7215 3.04226 16.987 3.56351L17.0535 3.70608C17.1977 4.04236 17.2629 4.40311 17.2956 4.80374C17.3324 5.25398 17.3318 5.81094 17.3318 6.50003V8.33304Z"/>
                      </svg>
                    ) : (
                      // Outline icon when not clicked
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 14v10"/>
                        <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h-3.5a2 2 0 0 1-2-2.5"/>
                      </svg>
                    )}
                  </button>
                )}

                {/* Regenerate Button */}
                <button
                  onClick={() => regenerateResponse(message.id)}
                  className="text-token-text-secondary"
                  style={{
                    borderRadius: '0.5rem',
                    padding: '0.25rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--token-bg-secondary, #f8f9fa)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  aria-label="Regenerate response"
                  title="Regenerate response"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                    <path d="M21 3v5h-5"/>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                    <path d="M3 21v-5h5"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', padding: '1rem' }}>
      <h2 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }} className="text-token-text-primary">
        LLM Chat Interface
      </h2>

      {/* Chat Messages Area */}
      <div ref={messagesContainerRef} style={{ flex: '1', overflowY: 'auto', marginBottom: '1rem', maxHeight: 'calc(100vh - 250px)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }} className="text-token-text-secondary">
              <svg style={{
                margin: '0 auto 1rem',
                height: '3rem',
                width: '3rem',
                color: '#9ca3af'
              }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p style={{ fontSize: '0.875rem' }}>Start a conversation with the AI assistant</p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                Generate prompts from your transcript or ask questions directly
              </p>
            </div>
          ) : (
            messages.map((message, index) => (
              <MessageBubble key={message.id} message={message} turnIndex={index + 1} />
            ))
          )}
          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Generate from Transcript Button */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={handleGenerateFromTranscript}
          style={{
            width: '100%',
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            fontSize: '0.875rem'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          Want to use AI to generate potential prompt from transcript?
        </button>
      </div>

      {/* Composer Interface */}
      <form
        style={{ width: '100%' }}
        data-type="unified-composer"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        <div className="bg-token-bg-primary shadow-short"
             style={{
               cursor: 'text',
               overflow: 'hidden',
               padding: '0.625rem',
               borderRadius: '28px',
               display: 'grid',
               gridTemplateColumns: '1fr auto'
             }}>

          {/* Primary (Text Input) */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.75rem' }}>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything"
              className="text-token-text-primary"
              rows={1}
              style={{
                width: '100%',
                resize: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                border: 'none',
                minHeight: '1.5rem',
                maxHeight: '200px'
              }}
            />
          </div>

          {/* Trailing (Send button) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="submit"
              disabled={!prompt.trim()}
              style={{
                display: 'flex',
                height: '2rem',
                width: '2rem',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                border: 'none',
                cursor: prompt.trim() ? 'pointer' : 'not-allowed',
                backgroundColor: prompt.trim() ? 'black' : '#e5e7eb',
                color: prompt.trim() ? 'white' : '#9ca3af'
              }}
              onMouseEnter={(e) => {
                if (prompt.trim()) {
                  e.currentTarget.style.backgroundColor = '#1f2937';
                }
              }}
              onMouseLeave={(e) => {
                if (prompt.trim()) {
                  e.currentTarget.style.backgroundColor = 'black';
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z"/>
              </svg>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
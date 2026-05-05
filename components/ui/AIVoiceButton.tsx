'use client'; // This is required in Next.js for browser APIs like the microphone

import { useState, useRef } from 'react';

export default function AIVoiceButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [statusText, setStatusText] = useState('');
  const recognitionRef = useRef<any>(null);

  const startRecording = () => {
    // Check if browser supports speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      setStatusText("Listening...");
    };

    // ADDITIVE: Sending the transcript to your Next.js backend
    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setStatusText(`Processing: "${transcript}"...`);
      
      try {
        const response = await fetch('/api/voice-command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript })
        });
        
        const data = await response.json();
        if (data.success) {
           setStatusText(`Success: ${data.actionType} added!`);
        } else {
           setStatusText(`Failed to process command.`);
        }
      } catch (error) {
        setStatusText('Error connecting to server.');
      }
    };

    recognition.onerror = (event: any) => {
      setStatusText(`Error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setTimeout(() => setStatusText(''), 4000); // Clear text after 4 seconds
    };

    recognition.start();
  };

  return (
    <>
      {/* The Floating Button */}
      <button
        onClick={startRecording}
        title="Click to Speak"
        style={{
          position: 'fixed',
          bottom: '30px',
          right: '30px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: isRecording ? '#d32f2f' : '#333333', // Red when recording, Nardo Grey otherwise
          color: 'white',
          fontSize: '24px',
          border: 'none',
          boxShadow: isRecording ? '0 0 0 10px rgba(211, 47, 47, 0.3)' : '0 4px 10px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          zIndex: 9999,
          transition: 'all 0.3s ease',
        }}
      >
        🎤
      </button>

      {/* The Status Popup */}
      {statusText && (
        <div style={{
          position: 'fixed',
          bottom: '100px',
          right: '30px',
          fontFamily: 'sans-serif',
          fontSize: '14px',
          color: '#333',
          background: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          zIndex: 9999,
          boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
        }}>
          {statusText}
        </div>
      )}
    </>
  );
}
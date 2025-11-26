import React, { useEffect, useState, useRef } from 'react';
import { User } from '../types';
import { Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createBlob, decodeAudioData, decode } from '../services/audioUtils';

interface CallOverlayProps {
  user: User;
  onEndCall: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ user, onEndCall }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  
  // Refs for Audio Handling
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const isClosingRef = useRef(false);

  useEffect(() => {
    // Initialize Gemini Live Session
    const startSession = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Setup Audio Contexts
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });

        // Request Mic Access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Connect to Gemini Live
        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: user.persona || "You are a helpful assistant.",
          },
          callbacks: {
            onopen: () => {
              console.log("Session Opened");
              setIsConnected(true);
              
              // Start Input Stream
              if (!inputContextRef.current) return;
              
              const source = inputContextRef.current.createMediaStreamSource(stream);
              sourceRef.current = source;
              
              const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
              processorRef.current = processor;

              processor.onaudioprocess = (e) => {
                if (isMuted) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Simple volume meter
                let sum = 0;
                for(let i=0; i<inputData.length; i++) sum += inputData[i]*inputData[i];
                const rms = Math.sqrt(sum/inputData.length);
                setVolumeLevel(Math.min(rms * 5, 1)); // Scale up for visuals

                const pcmBlob = createBlob(inputData);
                
                if (sessionPromiseRef.current && !isClosingRef.current) {
                    sessionPromiseRef.current.then(session => {
                        session.sendRealtimeInput({ media: pcmBlob });
                    });
                }
              };

              source.connect(processor);
              processor.connect(inputContextRef.current.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
              if (isClosingRef.current) return;

              const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              
              if (base64Audio && audioContextRef.current) {
                try {
                  const ctx = audioContextRef.current;
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  
                  const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    ctx,
                    24000,
                    1
                  );

                  const source = ctx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(ctx.destination);
                  
                  source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                  });

                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  sourcesRef.current.add(source);
                  
                  // Visual feedback for AI talking
                  setVolumeLevel(0.5 + Math.random() * 0.3);
                  setTimeout(() => setVolumeLevel(0), audioBuffer.duration * 1000);

                } catch (e) {
                  console.error("Audio Decode Error", e);
                }
              }

              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
              }
            },
            onclose: () => {
              console.log("Session Closed");
              handleCleanup();
            },
            onerror: (err) => {
              console.error("Session Error", err);
              handleCleanup();
            }
          }
        });
        
        sessionPromiseRef.current = sessionPromise;

      } catch (err) {
        console.error("Failed to start call", err);
        onEndCall();
      }
    };

    startSession();

    return () => {
      handleCleanup();
    };
  }, [user.persona]);

  const handleCleanup = () => {
    isClosingRef.current = true;
    
    // Close session
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
            try { session.close(); } catch(e) {}
        });
    }

    // Stop tracks
    streamRef.current?.getTracks().forEach(t => t.stop());
    
    // Disconnect nodes
    sourceRef.current?.disconnect();
    processorRef.current?.disconnect();
    
    // Close Contexts
    audioContextRef.current?.close();
    inputContextRef.current?.close();
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="absolute inset-0 z-50 bg-zinc-900 flex flex-col items-center justify-between py-12 animate-fade-in">
        {/* Top Info */}
        <div className="flex flex-col items-center mt-8">
            <div className="mb-6 relative">
                 {/* Pulsating Rings */}
                 <div className={`absolute inset-0 rounded-full border-2 border-blue-500/50 transition-all duration-300 ${isConnected ? 'animate-ping' : ''}`} style={{ opacity: volumeLevel }}></div>
                 <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-zinc-800 relative z-10">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                 </div>
            </div>
            <h2 className="text-2xl font-bold text-white">{user.name}</h2>
            <p className="text-blue-400 font-medium mt-1">
                {isConnected ? "Connected" : "Calling..."}
            </p>
        </div>

        {/* Controls */}
        <div className="w-full max-w-xs grid grid-cols-3 gap-6 items-center px-8">
             <button 
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700'}`}
             >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
             </button>
             
             <button 
               onClick={onEndCall}
               className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 shadow-lg shadow-red-500/20 transform hover:scale-105 transition-all"
             >
                <PhoneOff size={32} fill="currentColor" />
             </button>

             <button 
                className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center text-white hover:bg-zinc-700"
             >
                <Volume2 size={24} />
             </button>
        </div>
    </div>
  );
};

export default CallOverlay;


import React, { useState, useRef, useEffect } from 'react';
import { User, Message, MessageType, ChatTheme } from '../types';
import { Send, Image as ImageIcon, Info, Phone, Video, ArrowLeft, Camera, Heart, Mic, MoreHorizontal, Trash2, Smile } from 'lucide-react';

interface ChatWindowProps {
  currentUser: User;
  messages: Message[];
  onSendMessage: (text: string, image?: File, audioBlob?: Blob) => void;
  onBack: () => void;
  onCallStart: () => void;
  onShowInfo: () => void;
  isTyping?: boolean;
  onTyping?: (isTyping: boolean) => void;
  shouldOpenCam?: boolean;
  theme?: ChatTheme;
  onReact?: (messageId: string, emoji: string) => void;
}

// Standard reaction set
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥'];

const ChatWindow: React.FC<ChatWindowProps> = ({ currentUser, messages, onSendMessage, onBack, onCallStart, onShowInfo, isTyping, onTyping, shouldOpenCam, theme, onReact }) => {
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  // Typing Detection
  const typingTimeoutRef = useRef<number | null>(null);
  const isSelfTypingRef = useRef(false);

  // Reaction State
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isTyping, imagePreview, isRecording]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Close reaction menu on click outside
  useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
          if (activeReactionMenuId) {
              setActiveReactionMenuId(null);
          }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
  }, [activeReactionMenuId]);

  // Auto-open camera if triggered from Sidebar
  useEffect(() => {
    if (shouldOpenCam && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [shouldOpenCam]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    if (onTyping) {
        if (!isSelfTypingRef.current) {
            isSelfTypingRef.current = true;
            onTyping(true);
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = window.setTimeout(() => {
            isSelfTypingRef.current = false;
            onTyping(false);
        }, 2000);
    }
  };

  const handleSend = () => {
    if (!inputText.trim() && !selectedImage) return;
    
    // Clear typing status immediately on send
    if (onTyping && isSelfTypingRef.current) {
        isSelfTypingRef.current = false;
        onTyping(false);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    onSendMessage(inputText, selectedImage || undefined);
    setInputText("");
    setSelectedImage(null);
    setImagePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDoubleTap = (messageId: string) => {
      if (onReact) {
          onReact(messageId, '❤️');
      }
  };

  const handleReactionClick = (e: React.MouseEvent, messageId: string, emoji: string) => {
      e.stopPropagation();
      if (onReact) {
          onReact(messageId, emoji);
      }
      setActiveReactionMenuId(null);
  };

  const toggleReactionMenu = (e: React.MouseEvent, messageId: string) => {
      e.stopPropagation();
      setActiveReactionMenuId(activeReactionMenuId === messageId ? null : messageId);
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    if (mediaRecorderRef.current && isRecording) {
      const stream = mediaRecorderRef.current.stream;
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/webm'; // Prefer what browser gives, fallback webm

      mediaRecorderRef.current.onstop = () => {
        if (shouldSend && audioChunksRef.current.length > 0) {
          // Construct the blob with the correct type
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          onSendMessage("", undefined, audioBlob);
        }
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
    }

    setIsRecording(false);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Theme Style Construction
  const containerStyle: React.CSSProperties = {
    background: theme ? theme.value : '#000000',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="flex flex-col h-full w-full text-white relative transition-all duration-500 ease-in-out" style={containerStyle}>
      {/* Header - Glassmorphism */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-4 sticky top-0 z-10 backdrop-blur-md bg-black/40">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="md:hidden p-2 -ml-2">
            <ArrowLeft size={24} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={onShowInfo}>
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name} 
              className="w-8 h-8 rounded-full object-cover"
            />
            <div>
                <h2 className="font-semibold text-sm drop-shadow-md">{currentUser.name}</h2>
                <p className="text-xs text-zinc-300 drop-shadow-md">{isTyping ? 'Typing...' : (currentUser.isOnline ? 'Active now' : '')}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-white">
          <button onClick={onCallStart} className="hover:opacity-70 drop-shadow-md">
            <Phone size={24} />
          </button>
          <button onClick={onCallStart} className="hover:opacity-70 drop-shadow-md">
            <Video size={28} />
          </button>
          <button onClick={onShowInfo} className="hover:opacity-70 drop-shadow-md">
            <Info size={24} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 no-scrollbar bg-transparent">
        {/* Profile Spacer at top like IG */}
        <div className="flex flex-col items-center justify-center py-8 gap-2 mb-4">
             <img src={currentUser.avatar} className="w-20 h-20 rounded-full object-cover shadow-lg" alt="" />
             <h3 className="text-xl font-semibold drop-shadow-md">{currentUser.name}</h3>
             <p className="text-zinc-300 text-sm drop-shadow-md">Instagram</p>
             <button className="bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-semibold px-3 py-1 rounded-lg mt-1 hover:bg-white/20 transition-colors">View Profile</button>
        </div>

        {messages.map((msg) => {
          const isMe = msg.senderId === 'me';
          const reactions = Object.values(msg.reactions || {});
          const hasReactions = reactions.length > 0;
          const uniqueReactions = Array.from(new Set(reactions)).slice(0,3); // Show top 3 unique

          return (
            <div 
              key={msg.id} 
              className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-1 group relative`}
            >
              {/* Hover Actions (Like IG) - Left side for them, Right side for me implicitly handled by order */}
              {!isMe && (
                  <div className="hidden group-hover:flex items-center text-zinc-300 px-2 drop-shadow-md relative">
                      <div className="relative">
                          <button onClick={(e) => toggleReactionMenu(e, msg.id)} className="hover:text-white transition-colors">
                            <Smile size={14} />
                          </button>
                          {activeReactionMenuId === msg.id && (
                              <div className="absolute left-0 bottom-6 bg-[#262626] border border-zinc-700 rounded-full p-1.5 flex gap-1 shadow-lg z-20 animate-fade-in flex-wrap w-48 justify-center">
                                  {REACTION_EMOJIS.map(emoji => (
                                      <button 
                                        key={emoji} 
                                        onClick={(e) => handleReactionClick(e, msg.id, emoji)}
                                        className="hover:scale-125 transition-transform p-1 text-lg leading-none"
                                      >
                                          {emoji}
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                  </div>
              )}

              <div 
                  className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}
                  onDoubleClick={() => handleDoubleTap(msg.id)}
              >
                {msg.type === MessageType.IMAGE && (
                  <div className={`overflow-hidden rounded-[22px] border border-white/10 shadow-sm`}>
                    <img src={msg.content} alt="Shared" className="max-w-full h-auto" />
                  </div>
                )}
                
                {msg.type === MessageType.AUDIO && (
                  <div className={`flex items-center gap-2 p-3 rounded-[22px] shadow-sm ${isMe ? 'bg-[#3797F0] text-white' : 'bg-[#262626]/90 backdrop-blur-sm text-white'}`}>
                     <audio controls src={msg.content} className="h-8 w-48 sm:w-60 custom-audio" />
                  </div>
                )}

                {msg.type === MessageType.TEXT && msg.content && (
                  <div 
                    className={`px-4 py-3 rounded-[22px] text-[15px] leading-tight break-words whitespace-pre-wrap shadow-sm ${
                      isMe 
                        ? 'bg-[#3797F0] text-white' 
                        : 'bg-[#262626]/90 backdrop-blur-sm text-white'
                    }`}
                  >
                    {msg.content}
                  </div>
                )}
                
                {/* Reaction Pill */}
                {hasReactions && (
                    <div className={`absolute -bottom-2 ${isMe ? 'right-0' : 'left-0'} bg-[#262626] border border-black rounded-full px-1.5 py-0.5 text-xs shadow-md flex items-center gap-0.5 cursor-pointer z-10`}>
                        {uniqueReactions.map((r, i) => <span key={i}>{r}</span>)}
                        {reactions.length > 1 && <span className="text-zinc-400 ml-0.5">{reactions.length}</span>}
                    </div>
                )}
              </div>

               {/* Hover Actions Me - Right side */}
               {isMe && (
                  <div className="hidden group-hover:flex items-center text-zinc-300 px-2 order-first drop-shadow-md">
                       <div className="relative">
                          <button onClick={(e) => toggleReactionMenu(e, msg.id)} className="hover:text-white transition-colors">
                            <Smile size={14} />
                          </button>
                           {activeReactionMenuId === msg.id && (
                              <div className="absolute right-0 bottom-6 bg-[#262626] border border-zinc-700 rounded-full p-1.5 flex gap-1 shadow-lg z-20 animate-fade-in flex-wrap w-48 justify-center">
                                  {REACTION_EMOJIS.map(emoji => (
                                      <button 
                                        key={emoji} 
                                        onClick={(e) => handleReactionClick(e, msg.id, emoji)}
                                        className="hover:scale-125 transition-transform p-1 text-lg leading-none"
                                      >
                                          {emoji}
                                      </button>
                                  ))}
                              </div>
                          )}
                      </div>
                      <div className="ml-3 cursor-pointer hover:text-white"><MoreHorizontal size={14} /></div>
                  </div>
              )}
            </div>
          );
        })}
        
        {isTyping && (
          <div className="flex justify-start mb-2 ml-1">
            <div className="bg-[#262626]/80 backdrop-blur-md px-4 py-3 rounded-[22px] flex gap-1 items-center h-10 w-16">
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sticky bottom-0 backdrop-blur-md bg-black/40 border-t border-white/5">
        {imagePreview && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-[#262626] rounded-lg w-fit relative">
             <img src={imagePreview} className="h-16 w-16 object-cover rounded" alt="preview" />
             <button 
               onClick={() => { setImagePreview(null); setSelectedImage(null); }}
               className="absolute -top-2 -right-2 bg-zinc-700 rounded-full p-0.5 text-white"
             >
               <MoreHorizontal size={14} />
             </button>
          </div>
        )}
        
        <div className="flex items-center gap-3 bg-[#262626]/90 backdrop-blur-md border border-white/5 rounded-[22px] px-4 py-2 min-h-[44px] relative overflow-hidden shadow-lg">
          {isRecording ? (
            // Recording UI
            <div className="flex-1 flex items-center justify-between animate-fade-in">
              <div className="flex items-center gap-3 text-red-500">
                <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                <span className="font-mono font-medium text-sm">{formatTime(recordingTime)}</span>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => stopRecording(false)} 
                  className="text-zinc-400 hover:text-white transition-colors p-1"
                  title="Cancel"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={() => stopRecording(true)} 
                  className="bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
                  title="Send Voice Message"
                >
                   <Send size={18} className="ml-0.5" />
                </button>
              </div>
            </div>
          ) : (
            // Standard Input UI
            <>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="bg-[#3797F0] p-1.5 rounded-full cursor-pointer hover:opacity-90 shadow-sm"
              >
                <Camera size={18} className="text-white" />
              </div>
              <input
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Message..."
                className="flex-1 bg-transparent text-sm text-white focus:outline-none placeholder:text-zinc-500"
              />
              
              {inputText.trim() || imagePreview ? (
                <button onClick={handleSend} className="text-[#3797F0] font-semibold text-sm hover:text-white transition-colors">
                  Send
                </button>
              ) : (
                <div className="flex items-center gap-3 text-white">
                    <button onClick={startRecording} className="hover:opacity-70">
                        <Mic size={22} />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="hover:opacity-70">
                        <ImageIcon size={22} />
                    </button>
                    <button className="hover:opacity-70">
                        <Heart size={22} />
                    </button>
                </div>
              )}
              
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleImageSelect} 
              />
            </>
          )}
        </div>
      </div>
      <style>{`
        .custom-audio::-webkit-media-controls-panel {
          background-color: rgba(255,255,255,0.9);
        }
        .custom-audio::-webkit-media-controls-enclosure {
            border-radius: 50px;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;

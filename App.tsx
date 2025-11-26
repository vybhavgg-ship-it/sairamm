
import React, { useState, useEffect, useRef } from 'react';
import LockScreen from './components/LockScreen';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import CallOverlay from './components/CallOverlay';
import AuthFlow from './components/AuthFlow';
import Modal from './components/Modal';
import { User, Message, MessageType, UserProfile, ChatMetadata, ChatTheme } from './types';
import { generateChatResponse, analyzeImage, editImage, ChatPart } from './services/gemini';
import { MOCK_DB_USERS, findUserByUsername } from './services/userService';
import { Camera, Send, ImageIcon, Palette, ChevronLeft } from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';

const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const PRESET_THEMES: ChatTheme[] = [
  { id: 'default', type: 'color', value: 'transparent' }, // Transparent to show global animated BG
  // Solid Colors
  { id: 'black', type: 'color', value: '#000000' },
  { id: 'charcoal', type: 'color', value: '#18181b' }, // Zinc-900
  { id: 'navy', type: 'color', value: '#172554' }, // Blue-950
  { id: 'burgundy', type: 'color', value: '#450a0a' }, // Red-950
  { id: 'forest-solid', type: 'color', value: '#052e16' }, // Green-950
  { id: 'plum', type: 'color', value: '#4c1d95' }, // Violet-900
  // Gradients
  { id: 'midnight', type: 'gradient', value: 'linear-gradient(to bottom, #0f2027, #203a43, #2c5364)' },
  { id: 'sunset', type: 'gradient', value: 'linear-gradient(to bottom, #4b1248, #f0c27b)' },
  { id: 'love', type: 'gradient', value: 'linear-gradient(to bottom, #833ab4, #fd1d1d, #fcb045)' },
  { id: 'forest', type: 'gradient', value: 'linear-gradient(to bottom, #004d00, #000000)' },
  { id: 'ocean', type: 'gradient', value: 'linear-gradient(to bottom, #1cb5e0, #000046)' },
  { id: 'purple-haze', type: 'gradient', value: 'linear-gradient(to bottom, #240b36, #c31432)' },
];

const App: React.FC = () => {
  // User Profile & Auth State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('secretgram_profile');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.avatar) parsed.avatar = DEFAULT_AVATAR;
        return parsed;
      } catch (e) {
        console.error("Failed to parse profile", e);
        return null;
      }
    }
    return null;
  });
  
  const [locked, setLocked] = useState(true);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const activeUserIdRef = useRef<string | null>(null); // Track active user in Ref to avoid stale closures
  
  // Friends List
  const [myFriends, setMyFriends] = useState<User[]>(() => {
    const savedFriends = localStorage.getItem('secretgram_friends');
    return savedFriends ? JSON.parse(savedFriends) : [];
  });
  
  // Chat History
  const [chatSessions, setChatSessions] = useState<Record<string, Message[]>>(() => {
    try {
        const saved = localStorage.getItem('secretgram_chats');
        return saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error("Failed to load chat history", e);
        return {};
    }
  });

  // Metadata
  const [chatMetadata, setChatMetadata] = useState<Record<string, ChatMetadata>>(() => {
    try {
      const saved = localStorage.getItem('secretgram_chat_metadata');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [botTyping, setBotTyping] = useState<Record<string, boolean>>({});
  const [peerTyping, setPeerTyping] = useState<Record<string, boolean>>({});
  const [activeCallUser, setActiveCallUser] = useState<User | null>(null);
  
  // UI State
  const [modalType, setModalType] = useState<'info' | 'edit' | 'addFriend' | null>(null);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  
  const [editUsername, setEditUsername] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  
  const [searchUsername, setSearchUsername] = useState("");
  const [searchError, setSearchError] = useState("");
  const [shouldOpenCam, setShouldOpenCam] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const themeImageInputRef = useRef<HTMLInputElement>(null);

  // P2P Networking Refs
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Record<string, DataConnection>>({});

  // Sync activeUserId to Ref and Clear Unread
  useEffect(() => {
    activeUserIdRef.current = activeUserId;
    if (activeUserId) {
        setMyFriends(prev => prev.map(f => 
            (f.id === activeUserId && (f.unreadCount || 0) > 0)
                ? { ...f, unreadCount: 0 } 
                : f
        ));
    }
  }, [activeUserId]);

  // Sync friends to storage
  useEffect(() => {
    localStorage.setItem('secretgram_friends', JSON.stringify(myFriends));
  }, [myFriends]);

  // Sync chats to storage
  useEffect(() => {
    try {
        localStorage.setItem('secretgram_chats', JSON.stringify(chatSessions));
    } catch (e) {
        console.warn("Chat storage limit reached", e);
    }
  }, [chatSessions]);

  // Sync metadata
  useEffect(() => {
    localStorage.setItem('secretgram_chat_metadata', JSON.stringify(chatMetadata));
  }, [chatMetadata]);

  // Initialize PeerJS when profile is loaded
  useEffect(() => {
    if (userProfile && !peerRef.current) {
        // Sanitize username to be safe for PeerJS ID
        const peerId = userProfile.username.replace(/[^a-zA-Z0-9]/g, '_');
        const peer = new Peer(peerId);

        peer.on('open', (id) => {
            console.log('My Peer ID is: ' + id);
            // Attempt to reconnect to existing friends
            myFriends.forEach(friend => {
                if (!friend.isBot) {
                    connectToPeer(friend.username, friend.id);
                }
            });
        });

        peer.on('connection', (conn) => {
            console.log("Incoming connection from", conn.peer);
            setupConnection(conn);
        });

        peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            // If ID is taken, we might be in a duplicate tab or conflict
            if (err.type === 'unavailable-id') {
                console.error("ID taken. Are you open in another tab?");
            }
        });

        peerRef.current = peer;
    }

    return () => {
        // We generally don't destroy peer on unmount to keep connection alive during re-renders,
        // but for strict cleanup:
        // peerRef.current?.destroy(); 
    };
  }, [userProfile]);

  const connectToPeer = (targetUsername: string, friendId?: string) => {
      if (!peerRef.current) return;
      
      const targetPeerId = targetUsername.replace(/[^a-zA-Z0-9]/g, '_');
      const conn = peerRef.current.connect(targetPeerId);
      
      conn.on('open', () => {
          console.log("Connected to", targetPeerId);
          setupConnection(conn, friendId);
      });
      
      conn.on('error', (err) => {
          console.error("Connection failed", err);
      });
  };

  const setupConnection = (conn: DataConnection, existingFriendId?: string) => {
      // Store connection
      // We map connection ID (or peer ID) to our user ID system
      
      conn.on('data', (data: any) => {
          handleIncomingData(data, conn.peer);
      });

      conn.on('close', () => {
          console.log("Connection closed with", conn.peer);
          updateFriendStatus(conn.peer, false);
          const key = Object.keys(connectionsRef.current).find(k => connectionsRef.current[k] === conn);
          if (key) delete connectionsRef.current[key];
      });

      // If we initiated, we might know the FriendID. If incoming, we need to find it or create it.
      let friendId = existingFriendId;
      
      // Check if we already have this friend by peerID matching username
      if (!friendId) {
          const found = myFriends.find(f => f.username.replace(/[^a-zA-Z0-9]/g, '_') === conn.peer);
          if (found) friendId = found.id;
      }

      if (friendId) {
          connectionsRef.current[friendId] = conn;
          updateFriendStatus(conn.peer, true);
      } else {
          // Incoming from unknown user? We could auto-add them or put in requests.
          // For this app version, we'll auto-add if they send a handshake message or first message.
          // We'll store it temporarily mapped by peerID until we get profile info
          connectionsRef.current[conn.peer] = conn;
      }
  };

  const updateFriendStatus = (peerId: string, isOnline: boolean) => {
      setMyFriends(prev => prev.map(f => {
          if (f.username.replace(/[^a-zA-Z0-9]/g, '_') === peerId) {
              return { ...f, isOnline };
          }
          return f;
      }));
  };

  const handleIncomingData = (data: any, senderPeerId: string) => {
      // If it's a handshake/profile info
      if (data.type === 'PROFILE_INFO') {
          const { username, displayName, avatar } = data.payload;
          
          // Check if we have this friend
          setMyFriends(prev => {
              const exists = prev.find(f => f.username === username);
              if (exists) {
                  // Update info if changed
                  if (exists.avatar !== avatar || exists.name !== displayName) {
                      return prev.map(f => f.username === username ? { ...f, name: displayName, avatar, isOnline: true } : f);
                  }
                  return prev.map(f => f.username === username ? { ...f, isOnline: true } : f);
              } else {
                  // Add new friend
                  const newFriend: User = {
                      id: `user-${Date.now()}`, // Generate local ID
                      username,
                      name: displayName,
                      avatar,
                      isBot: false,
                      isOnline: true
                  };
                  // Map connection to new ID
                  connectionsRef.current[newFriend.id] = connectionsRef.current[senderPeerId];
                  delete connectionsRef.current[senderPeerId]; // Remove temporary key
                  return [newFriend, ...prev];
              }
          });
      }
      
      // If it's a message
      if (data.type === 'MESSAGE') {
          const { content, messageType, timestamp, meta } = data.payload;
          
          // Find sender ID
          let senderId: string | undefined;
          
          // Try to find by stored connection
          senderId = Object.keys(connectionsRef.current).find(k => connectionsRef.current[k].peer === senderPeerId);
          
          // Fallback search by username
          if (!senderId) {
             const user = myFriends.find(f => f.username.replace(/[^a-zA-Z0-9]/g, '_') === senderPeerId);
             if (user) senderId = user.id;
          }

          if (senderId) {
              // Reset typing status on message receive
              setPeerTyping(prev => ({ ...prev, [senderId!]: false }));
              
              const msg: Message = {
                  id: Date.now().toString(),
                  senderId: senderId,
                  content,
                  type: messageType,
                  timestamp,
                  meta
              };
              addMessage(senderId, msg);
          }
      }

      // If it's a typing indicator
      if (data.type === 'TYPING') {
          const { isTyping } = data.payload;
          
          let senderId: string | undefined;
          senderId = Object.keys(connectionsRef.current).find(k => connectionsRef.current[k].peer === senderPeerId);
          if (!senderId) {
             const user = myFriends.find(f => f.username.replace(/[^a-zA-Z0-9]/g, '_') === senderPeerId);
             if (user) senderId = user.id;
          }

          if (senderId) {
              setPeerTyping(prev => ({ ...prev, [senderId!]: isTyping }));
          }
      }

      // If it's a reaction
      if (data.type === 'REACTION') {
          const { messageId, emoji } = data.payload;
          
          let senderId: string | undefined;
          senderId = Object.keys(connectionsRef.current).find(k => connectionsRef.current[k].peer === senderPeerId);
          if (!senderId) {
             const user = myFriends.find(f => f.username.replace(/[^a-zA-Z0-9]/g, '_') === senderPeerId);
             if (user) senderId = user.id;
          }

          if (senderId) {
              setChatSessions(prev => {
                  const history = prev[senderId!] || [];
                  return {
                      ...prev,
                      [senderId!]: history.map(m => {
                          if (m.id === messageId) {
                               const currentReactions = m.reactions || {};
                               const newReactions = { ...currentReactions };
                               // Toggle logic matching handleReaction
                               if (newReactions[senderId!] === emoji) {
                                   delete newReactions[senderId!];
                               } else {
                                   newReactions[senderId!] = emoji;
                               }
                               return { ...m, reactions: newReactions };
                          }
                          return m;
                      })
                  };
              });
          }
      }
  };

  const handleProfileComplete = (profile: UserProfile) => {
    const completeProfile = { ...profile, avatar: profile.avatar || DEFAULT_AVATAR };
    setUserProfile(completeProfile);
    localStorage.setItem('secretgram_profile', JSON.stringify(completeProfile));
    setLocked(false); 
  };

  const handleUnlock = () => {
    setLocked(false);
  };

  const handleForgotPin = () => {
    if (window.confirm("WARNING: This will delete your account and all local messages. Are you sure you want to reset?")) {
        localStorage.removeItem('secretgram_profile');
        localStorage.removeItem('secretgram_friends');
        localStorage.removeItem('secretgram_chats');
        localStorage.removeItem('secretgram_chat_metadata');
        setUserProfile(null);
        setLocked(false);
        setChatSessions({}); 
        setMyFriends([]);
        setChatMetadata({});
        // Destroy peer
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
    }
  };

  const handleEditProfile = () => {
    if (userProfile) {
        setEditUsername(userProfile.username);
        setEditDisplayName(userProfile.displayName);
        setEditAvatar(userProfile.avatar || DEFAULT_AVATAR);
        setModalType('edit');
    }
  };

  const handleNewAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if(event.target?.result) setEditAvatar(event.target.result as string);
        }
        reader.readAsDataURL(e.target.files[0]);
    }
  };

  const saveProfileUpdate = () => {
    if (userProfile && editUsername.trim() && editDisplayName.trim()) {
        const updated: UserProfile = { 
            ...userProfile, 
            username: editUsername,
            displayName: editDisplayName,
            avatar: editAvatar || DEFAULT_AVATAR
        };
        setUserProfile(updated);
        localStorage.setItem('secretgram_profile', JSON.stringify(updated));
        setModalType(null);
        
        // Broadcast profile update to all connected peers
        Object.values(connectionsRef.current).forEach((conn: any) => {
            if (conn.open) {
                conn.send({
                    type: 'PROFILE_INFO',
                    payload: {
                        username: updated.username,
                        displayName: updated.displayName,
                        avatar: updated.avatar
                    }
                });
            }
        });
    }
  };

  const handleAddFriend = () => {
      setSearchUsername("");
      setSearchError("");
      setModalType('addFriend');
  };

  const performSearch = () => {
      setSearchError("");
      if (!searchUsername.trim()) return;

      // Check locally first
      if (myFriends.some(f => f.username.toLowerCase() === searchUsername.toLowerCase())) {
          setSearchError("User is already in your chat list.");
          return;
      }

      // Check if it's a bot (from mock DB)
      const bot = findUserByUsername(searchUsername);
      if (bot) {
          setMyFriends(prev => [bot, ...prev]);
          setModalType(null);
          setActiveUserId(bot.id);
          return;
      }

      // If not a bot, assume it's a real user on P2P network
      // We optimistically add them and try to connect
      const newFriendId = `user-${Date.now()}`;
      const newFriend: User = {
          id: newFriendId,
          username: searchUsername,
          name: searchUsername, // Temporary name until we connect
          avatar: DEFAULT_AVATAR,
          isBot: false,
          isOnline: false
      };
      
      setMyFriends(prev => [newFriend, ...prev]);
      setModalType(null);
      setActiveUserId(newFriendId);
      
      // Init Connection
      connectToPeer(searchUsername, newFriendId);
      
      // If connection works, we'll get their real name and avatar via 'PROFILE_INFO' event later
  };

  const handleQuickCamera = (userId: string) => {
    setActiveUserId(userId);
    setShouldOpenCam(true);
    setTimeout(() => setShouldOpenCam(false), 1000);
  };

  const addMessage = (userId: string, message: Message) => {
    // 1. Update Chat Sessions
    setChatSessions(prev => ({
      ...prev,
      [userId]: [...(prev[userId] || []), message]
    }));

    // 2. Update Friend List Metadata (Last Message, Unread Count)
    setMyFriends(prev => prev.map(u => {
        if (u.id === userId) {
            const isMe = message.senderId === 'me';
            const isChatOpen = activeUserIdRef.current === userId;
            // Increment unread if message is incoming and chat is NOT open
            const shouldIncrement = !isMe && !isChatOpen;

            return {
                ...u,
                lastMessage: message.type === MessageType.IMAGE ? 'Sent an image' : 
                             message.type === MessageType.AUDIO ? 'Sent a voice message' : 
                             message.content,
                unreadCount: shouldIncrement ? (u.unreadCount || 0) + 1 : (u.unreadCount || 0),
                lastSeen: 'now' // Update last seen on new message
            };
        }
        return u;
    }));
  };

  const handleUpdateTheme = (theme: ChatTheme) => {
    if (!activeUserId) return;
    setChatMetadata(prev => ({
      ...prev,
      [activeUserId]: { ...prev[activeUserId], theme }
    }));
  };

  const handleCustomBackground = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && activeUserId) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if(event.target?.result) {
                const theme: ChatTheme = {
                    id: 'custom',
                    type: 'image',
                    value: `url(${event.target.result as string})`
                };
                handleUpdateTheme(theme);
            }
        };
        reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (!activeUserId) return;
    const conn = connectionsRef.current[activeUserId];
    if (conn && conn.open) {
        conn.send({
            type: 'TYPING',
            payload: { isTyping }
        });
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!activeUserId) return;

    // Update local state
    setChatSessions(prev => {
        const history = prev[activeUserId] || [];
        return {
            ...prev,
            [activeUserId]: history.map(m => {
                if (m.id === messageId) {
                    const currentReactions = m.reactions || {};
                    const newReactions = { ...currentReactions };
                    // Toggle logic: if clicking same emoji, remove it. If different, add/update it.
                    if (newReactions['me'] === emoji) {
                        delete newReactions['me'];
                    } else {
                        newReactions['me'] = emoji;
                    }
                    return { ...m, reactions: newReactions };
                }
                return m;
            })
        };
    });

    // Send to peer
    const conn = connectionsRef.current[activeUserId];
    if (conn && conn.open) {
        conn.send({
            type: 'REACTION',
            payload: { messageId, emoji }
        });
    }
  };

  const handleSendMessage = async (text: string, imageFile?: File, audioBlob?: Blob) => {
    if (!activeUserId) return;

    const currentUser = myFriends.find(u => u.id === activeUserId);
    if (!currentUser) return;

    // 1. Process user input
    let imageBase64: string | undefined;
    let audioBase64: string | undefined;
    
    if (imageFile) {
      imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageFile);
      });

      const imageMsg: Message = {
        id: Date.now().toString(),
        senderId: 'me',
        type: MessageType.IMAGE,
        content: imageBase64!,
        timestamp: Date.now()
      };
      addMessage(activeUserId, imageMsg);
      
      // P2P Send
      if (!currentUser.isBot && connectionsRef.current[activeUserId]?.open) {
          connectionsRef.current[activeUserId].send({
              type: 'MESSAGE',
              payload: { content: imageBase64, messageType: MessageType.IMAGE, timestamp: Date.now() }
          });
      }
    }

    if (audioBlob) {
      audioBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
      });

      const audioMsg: Message = {
          id: (Date.now() + 1).toString(),
          senderId: 'me',
          type: MessageType.AUDIO,
          content: audioBase64!,
          timestamp: Date.now(),
          meta: { mimeType: audioBlob.type }
      };
      addMessage(activeUserId, audioMsg);
      
      // P2P Send
      if (!currentUser.isBot && connectionsRef.current[activeUserId]?.open) {
          connectionsRef.current[activeUserId].send({
              type: 'MESSAGE',
              payload: { content: audioBase64, messageType: MessageType.AUDIO, timestamp: Date.now(), meta: { mimeType: audioBlob.type } }
          });
      }
    }

    if (text) {
      const textMsg: Message = {
        id: (Date.now() + 2).toString(),
        senderId: 'me',
        type: MessageType.TEXT,
        content: text,
        timestamp: Date.now()
      };
      addMessage(activeUserId, textMsg);
      
      // P2P Send
      if (!currentUser.isBot) {
          const conn = connectionsRef.current[activeUserId];
          if (conn && conn.open) {
            conn.send({
                type: 'MESSAGE',
                payload: { content: text, messageType: MessageType.TEXT, timestamp: Date.now() }
            });
          } else {
             console.log("User not connected, message saved locally only.");
          }
      }
    }

    // 3. Trigger AI Response (Only if Bot)
    if (currentUser.isBot) {
        setBotTyping(prev => ({ ...prev, [activeUserId]: true }));
      
        try {
            let responseText = "";
            let responseImageBase64: string | undefined;

            if (currentUser.botType === 'vision') {
                let targetImage = imageBase64;
                if (!targetImage) {
                    const history = chatSessions[activeUserId] || [];
                    const lastImageMsg = [...history].reverse().find(m => m.senderId === 'me' && m.type === MessageType.IMAGE);
                    if (lastImageMsg) targetImage = lastImageMsg.content;
                }

                if (targetImage) {
                    const cleanBase64 = targetImage.split(',')[1];
                    responseText = await analyzeImage(cleanBase64, text || "What is this?");
                } else if (audioBase64) {
                    const cleanAudio = audioBase64.split(',')[1];
                    const parts: ChatPart[] = [
                    { inlineData: { mimeType: 'audio/webm', data: cleanAudio } },
                    { text: "Listen to this and reply." }
                    ];
                    responseText = await generateChatResponse([{ role: 'user', parts }], currentUser.persona);
                } else {
                    responseText = "Please upload an image for me to analyze!";
                }
            } 
            else if (currentUser.botType === 'editor') {
                let targetImage = imageBase64;
                if (!targetImage) {
                    const history = chatSessions[activeUserId] || [];
                    const lastImageMsg = [...history].reverse().find(m => m.senderId === 'me' && m.type === MessageType.IMAGE);
                    if (lastImageMsg) targetImage = lastImageMsg.content;
                }

                if (targetImage && text) {
                const cleanBase64 = targetImage.split(',')[1];
                const result = await editImage(cleanBase64, text);
                if (result.image) {
                    responseImageBase64 = `data:image/jpeg;base64,${result.image}`;
                } 
                responseText = result.text || (result.image ? "Here is your edited image:" : "I couldn't edit that.");
                } else if (targetImage && !text) {
                responseText = "Great image! What would you like me to change?";
                } else {
                responseText = "Please upload an image and tell me how to edit it.";
                }
            }
            else {
                // General Persona Bot (Chat)
                const currentHistory = (chatSessions[activeUserId] || []).map(m => {
                    const parts: ChatPart[] = [];
                    if (m.type === MessageType.TEXT) {
                        parts.push({ text: m.content });
                    } else if (m.type === MessageType.IMAGE) {
                        parts.push({ inlineData: { mimeType: 'image/jpeg', data: m.content.split(',')[1] } });
                    } else if (m.type === MessageType.AUDIO) {
                        parts.push({ inlineData: { mimeType: m.meta?.mimeType || 'audio/webm', data: m.content.split(',')[1] } });
                    }
                    return {
                        role: m.senderId === 'me' ? 'user' : 'model',
                        parts
                    };
                });

                if (imageBase64) currentHistory.push({ role: 'user', parts: [{ inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] } }] });
                if (audioBase64) currentHistory.push({ role: 'user', parts: [{ inlineData: { mimeType: 'audio/webm', data: audioBase64.split(',')[1] } }] });
                if (text) currentHistory.push({ role: 'user', parts: [{ text }] });
                
                if (audioBase64 && !text && !imageBase64) currentHistory[currentHistory.length - 1].parts.push({ text: "Reply to this voice message." });

                const persona = currentUser.persona || "You are a helpful friend.";
                responseText = await generateChatResponse(currentHistory, persona);
            }

            // Add Response(s)
            if (responseImageBase64) {
                const botImageMsg: Message = {
                    id: (Date.now() + 3).toString(),
                    senderId: activeUserId,
                    type: MessageType.IMAGE,
                    content: responseImageBase64,
                    timestamp: Date.now()
                };
                addMessage(activeUserId, botImageMsg);
            }

            if (responseText) {
                const botTextMsg: Message = {
                    id: (Date.now() + 4).toString(),
                    senderId: activeUserId,
                    type: MessageType.TEXT,
                    content: responseText,
                    timestamp: Date.now()
                };
                addMessage(activeUserId, botTextMsg);
            }

        } catch (err) {
            console.error(err);
        } finally {
            setBotTyping(prev => ({ ...prev, [activeUserId]: false }));
        }
    } else {
        // Handle Real User Connection check
        // If we just sent a message, we also want to send our profile info to ensure they have our avatar/name
        if (connectionsRef.current[activeUserId]?.open && userProfile) {
            connectionsRef.current[activeUserId].send({
                type: 'PROFILE_INFO',
                payload: {
                    username: userProfile.username,
                    displayName: userProfile.displayName,
                    avatar: userProfile.avatar
                }
            });
        }
    }
  };

  const handleStartCall = () => {
    if (activeUserId) {
        const user = myFriends.find(u => u.id === activeUserId);
        if (user) setActiveCallUser(user);
    }
  };

  if (!userProfile) return <AuthFlow onComplete={handleProfileComplete} />;
  
  if (locked) {
    return <LockScreen onUnlock={handleUnlock} expectedPass="030607" onForgotPass={handleForgotPin} />;
  }

  const activeUser = activeUserId ? myFriends.find(u => u.id === activeUserId) : null;
  const currentChatTheme = activeUserId ? chatMetadata[activeUserId]?.theme : undefined;

  return (
    <div className="flex h-full w-full bg-animated text-white font-sans relative overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>
      
      {activeCallUser && (
          <CallOverlay user={activeCallUser} onEndCall={() => setActiveCallUser(null)} />
      )}

      {/* Modals */}
      <Modal 
        isOpen={modalType === 'edit'} 
        onClose={() => setModalType(null)}
        title="Edit Profile"
        actions={
            <button onClick={saveProfileUpdate} className="bg-[#3797F0] text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-semibold text-sm">Done</button>
        }
      >
        <div className="flex flex-col gap-4 items-center">
            <div className="relative w-24 h-24 group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <img src={editAvatar} className="w-full h-full rounded-full object-cover border border-zinc-800" alt="Avatar" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 rounded-full transition-opacity"><Camera size={24} /></div>
            </div>
            <input type="file" ref={avatarInputRef} onChange={handleNewAvatarSelect} className="hidden" accept="image/*" />
            <div className="w-full space-y-3">
                <input value={editDisplayName} onChange={(e) => setEditDisplayName(e.target.value)} className="w-full bg-[#262626] border border-[#363636] rounded p-2.5 text-white focus:outline-none text-sm" placeholder="Display Name"/>
                <input value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="w-full bg-[#262626] border border-[#363636] rounded p-2.5 text-white focus:outline-none text-sm" placeholder="Username"/>
            </div>
        </div>
      </Modal>

      <Modal 
        isOpen={modalType === 'addFriend'} 
        onClose={() => setModalType(null)}
        title="New Message"
        actions={
            <button onClick={performSearch} className="bg-[#3797F0] text-white px-4 py-2 rounded-lg hover:bg-blue-600 font-semibold text-sm disabled:opacity-50" disabled={!searchUsername}>Chat</button>
        }
      >
        <div className="flex flex-col gap-3">
            <label className="text-sm font-semibold">To:</label>
            <input value={searchUsername} onChange={(e) => setSearchUsername(e.target.value)} className="bg-transparent border-b border-[#363636] py-2 text-white focus:outline-none placeholder:text-zinc-500" placeholder="Search username..." autoFocus />
            {searchError && <p className="text-red-500 text-xs">{searchError}</p>}
            <div className="mt-4">
                <p className="text-xs text-zinc-500 mb-2 font-semibold">Suggested Bots:</p>
                <div className="space-y-2">
                    <div onClick={() => setSearchUsername('vision_ai')} className="cursor-pointer hover:bg-white/5 p-2 rounded flex items-center gap-2"><span className="text-sm">vision_ai</span></div>
                    <div onClick={() => setSearchUsername('magic_editor')} className="cursor-pointer hover:bg-white/5 p-2 rounded flex items-center gap-2"><span className="text-sm">magic_editor</span></div>
                </div>
            </div>
        </div>
      </Modal>

      <Modal 
        isOpen={modalType === 'info' && !!activeUser} 
        onClose={() => { setModalType(null); setIsThemePickerOpen(false); }}
        title={isThemePickerOpen ? "Themes" : "Details"}
        actions={isThemePickerOpen ? (<button onClick={() => setIsThemePickerOpen(false)} className="text-[#3797F0] font-semibold text-sm">Done</button>) : undefined}
      >
        {activeUser && (
            isThemePickerOpen ? (
                <div className="pt-2">
                   <div className="flex items-center gap-2 mb-4 cursor-pointer text-zinc-400 hover:text-white" onClick={() => setIsThemePickerOpen(false)}><ChevronLeft size={20} /><span className="text-sm">Back</span></div>
                   <div className="grid grid-cols-4 gap-4 mb-6">
                       {PRESET_THEMES.map(t => (
                           <button key={t.id} onClick={() => handleUpdateTheme(t)} className={`w-12 h-12 rounded-full border-2 ${currentChatTheme?.id === t.id ? 'border-white scale-110' : 'border-transparent'} shadow-lg transition-all`} style={{ background: t.value }} title={t.id} />
                       ))}
                   </div>
                   <button onClick={() => themeImageInputRef.current?.click()} className="w-full bg-[#262626] rounded-xl p-4 flex items-center gap-3 hover:bg-[#363636] transition-colors text-left">
                       <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center"><ImageIcon size={20} className="text-zinc-400"/></div>
                       <div><div className="text-sm font-semibold">Upload Background</div></div>
                   </button>
                   <input type="file" ref={themeImageInputRef} className="hidden" accept="image/*" onChange={handleCustomBackground} />
                </div>
            ) : (
                <div className="flex flex-col items-center gap-4 pt-2">
                    <img src={activeUser.avatar} className="w-20 h-20 rounded-full border border-zinc-800" alt={activeUser.name} />
                    <div className="text-center">
                        <h4 className="font-bold text-xl">{activeUser.name}</h4>
                        <p className="text-zinc-400 text-sm">@{activeUser.username}</p>
                        {!activeUser.isBot && (
                            <div className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-block ${activeUser.isOnline ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>
                                {activeUser.isOnline ? 'Connected (P2P)' : 'Offline'}
                            </div>
                        )}
                    </div>
                    <div className="w-full mt-4 border-t border-[#363636]">
                    <div onClick={() => setIsThemePickerOpen(true)} className="py-3 px-2 flex items-center gap-3 cursor-pointer hover:bg-white/5">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center border border-zinc-700" style={{ background: currentChatTheme?.value || '#000' }}><Palette size={16} className="text-white drop-shadow-md"/></div>
                        <div className="text-sm font-medium">Theme</div>
                    </div>
                    </div>
                </div>
            )
        )}
      </Modal>

      <div className={`${activeUserId ? 'hidden md:flex' : 'flex'} w-full md:w-[400px] h-full relative z-10 border-r border-[#262626]`}>
        <Sidebar 
          users={myFriends.map(u => ({
            ...u,
            // Only update lastMessage if we have history
            lastMessage: chatSessions[u.id]?.length > 0 
              ? (chatSessions[u.id][chatSessions[u.id].length - 1].type === MessageType.IMAGE ? 'Sent an image' : 
                 chatSessions[u.id][chatSessions[u.id].length - 1].type === MessageType.AUDIO ? 'Sent a voice message' :
                 chatSessions[u.id][chatSessions[u.id].length - 1].content)
              : u.lastMessage
          }))}
          activeUserId={activeUserId}
          onSelectUser={setActiveUserId}
          username={userProfile.username}
          displayName={userProfile.displayName}
          userAvatar={userProfile.avatar}
          onEditProfile={handleEditProfile}
          onQuickCamera={handleQuickCamera}
          onAddFriend={handleAddFriend}
        />
      </div>

      <div className={`${!activeUserId ? 'hidden md:flex' : 'flex'} flex-1 h-full z-10 justify-center items-center`}>
        {activeUserId && activeUser ? (
          <ChatWindow 
            currentUser={activeUser}
            messages={chatSessions[activeUserId] || []}
            onSendMessage={handleSendMessage}
            onBack={() => setActiveUserId(null)}
            onCallStart={handleStartCall}
            onShowInfo={() => { setModalType('info'); setIsThemePickerOpen(false); }}
            isTyping={botTyping[activeUserId] || peerTyping[activeUserId]}
            onTyping={handleTyping}
            shouldOpenCam={shouldOpenCam}
            theme={currentChatTheme}
            onReact={handleReaction}
          />
        ) : (
          <div className="hidden md:flex flex-col items-center gap-3 animate-fade-in p-8 text-center bg-black/40 backdrop-blur-md rounded-2xl border border-white/5">
            <div className="w-24 h-24 rounded-full border-2 border-white flex items-center justify-center mb-2">
                <svg aria-label="Direct" fill="currentColor" height="48" role="img" viewBox="0 0 24 24" width="48"><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
            </div>
            <h2 className="text-xl">Your Messages</h2>
            <p className="text-zinc-400 text-sm max-w-xs">Send private photos and messages to a friend or group.</p>
            <button onClick={handleAddFriend} className="bg-[#3797F0] px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors mt-2">Send Message</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;

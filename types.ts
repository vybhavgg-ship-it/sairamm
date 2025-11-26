
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
}

export interface Message {
  id: string;
  senderId: string; // 'me' or user ID
  content: string; // Text or Base64 Image/Audio Data
  type: MessageType;
  timestamp: number;
  meta?: {
    prompt?: string; // For image generation context
    mimeType?: string; // For audio/image mime types
  };
  reactions?: Record<string, string>; // userId -> emoji mapping
}

export interface User {
  id: string;
  username: string; // Unique ID handle
  name: string; // Display Name
  avatar: string;
  isBot: boolean;
  botType?: 'vision' | 'editor' | 'chat';
  persona?: string; // AI System Instruction for simulated users
  lastMessage?: string;
  lastSeen?: string;
  unreadCount?: number;
  isOnline?: boolean; // True if P2P connection is active
}

export interface UserProfile {
  email: string;
  username: string; // Unique ID handle
  displayName: string;
  password: string;
  avatar: string;
}

export interface ChatSession {
  userId: string;
  messages: Message[];
}

export interface ChatTheme {
  id: string;
  type: 'color' | 'image' | 'gradient';
  value: string;
}

export interface ChatMetadata {
  theme?: ChatTheme;
  muted?: boolean;
}

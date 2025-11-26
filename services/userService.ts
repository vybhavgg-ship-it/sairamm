import { User } from '../types';

// Mock Database of "Online" Users (Bots and Fake People)
export const MOCK_DB_USERS: User[] = [
  {
    id: 'bot-vision',
    username: 'vision_ai',
    name: 'Vision Bot',
    avatar: 'https://picsum.photos/100/100?random=1',
    isBot: true,
    botType: 'vision',
    persona: 'You are a helpful AI assistant that can analyze images.',
    lastMessage: 'Send me a photo to analyze!',
    lastSeen: 'now'
  },
  {
    id: 'bot-editor',
    username: 'magic_editor',
    name: 'Magic Editor',
    avatar: 'https://picsum.photos/100/100?random=2',
    isBot: true,
    botType: 'editor',
    persona: 'You are a creative AI artist helping users edit photos.',
    lastMessage: 'Upload photo + text to edit.',
    lastSeen: 'now'
  },
  {
    id: 'user-crush',
    username: 'cool_alex',
    name: 'Alex (Crush)',
    avatar: 'https://picsum.photos/100/100?random=3',
    isBot: false,
    persona: 'You are Alex, the user\'s crush. You are flirtatious but play hard to get. You text in short, casual sentences.',
    lastMessage: 'See you tonight?',
    lastSeen: '5m'
  },
  {
    id: 'user-bestie',
    username: 'sarah_xo',
    name: 'Sarah (Bestie)',
    avatar: 'https://picsum.photos/100/100?random=4',
    isBot: false,
    persona: 'You are Sarah, the user\'s best friend. You are high energy, supportive, and love gossip.',
    lastMessage: 'LOL no way',
    lastSeen: '22m'
  },
  {
    id: 'user-gamer',
    username: 'pro_gamer_99',
    name: 'Mikey',
    avatar: 'https://picsum.photos/100/100?random=6',
    isBot: false,
    persona: 'You are a hardcore gamer.',
    lastMessage: 'Hop on discord',
    lastSeen: '2h'
  }
];

// Simulates checking if a username or display name is taken in the "Cloud"
export const checkAvailability = (username: string, displayName: string): { available: boolean; error?: string } => {
  const lowerUser = username.toLowerCase();
  const lowerDisplay = displayName.toLowerCase();

  // Check against Mock DB
  const existsInDb = MOCK_DB_USERS.some(u => 
    u.username.toLowerCase() === lowerUser || u.name.toLowerCase() === lowerDisplay
  );

  if (existsInDb) {
    return { available: false, error: 'Username or Display Name is already taken by another user.' };
  }

  // Check against Local Storage (The user's own previous profile if exists, though usually overwritten)
  const saved = localStorage.getItem('secretgram_profile');
  if (saved) {
    const profile = JSON.parse(saved);
    // If trying to register a new account but name conflicts with old stored one (edge case)
    if (profile.username.toLowerCase() === lowerUser && profile.username !== '') {
       // We allow overwriting own local profile usually, but strictly following prompt rules:
       // For this simulation, we assume a clean slate or unique requirement.
    }
  }

  return { available: true };
};

// Simulates searching for a friend online
export const findUserByUsername = (username: string): User | null => {
  const user = MOCK_DB_USERS.find(u => u.username.toLowerCase() === username.toLowerCase());
  return user || null;
};
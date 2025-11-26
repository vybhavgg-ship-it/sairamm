import React from 'react';
import { User } from '../types';
import { Edit, ChevronDown, SquarePen } from 'lucide-react';

interface SidebarProps {
  users: User[];
  activeUserId: string | null;
  onSelectUser: (id: string) => void;
  username?: string;
  displayName?: string;
  userAvatar?: string;
  onEditProfile: () => void;
  onQuickCamera: (userId: string) => void;
  onAddFriend: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ users, activeUserId, onSelectUser, username, displayName, userAvatar, onEditProfile, onQuickCamera, onAddFriend }) => {
  
  const handleQuickCam = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    onQuickCamera(userId);
  };

  return (
    <div className="h-full w-full flex flex-col bg-black/40 backdrop-blur-xl">
      {/* Header */}
      <div className="h-16 px-5 flex items-center justify-between sticky top-0 bg-transparent z-10">
        <div 
          onClick={onEditProfile}
          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
        >
          <h1 className="text-xl font-bold truncate text-white">{username || 'username'}</h1>
          <ChevronDown size={16} className="text-white" />
        </div>
        <button onClick={onAddFriend} className="text-white hover:opacity-70">
            <SquarePen size={24} />
        </button>
      </div>

      {/* Tabs */}
      <div className="px-5 flex gap-6 mb-2">
        <div className="pb-3 border-b-2 border-white cursor-pointer">
           <span className="font-semibold text-white text-sm">Messages</span>
        </div>
        <div className="pb-3 cursor-pointer text-zinc-500 hover:text-zinc-300">
           <span className="font-semibold text-sm">Requests</span>
        </div>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {users.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 p-6 text-center">
                 <div className="w-16 h-16 rounded-full border-2 border-zinc-800 flex items-center justify-center mb-4">
                    <SquarePen size={24} className="text-zinc-500"/>
                 </div>
                 <h3 className="text-lg font-semibold text-white mb-1">Message your friends</h3>
                 <p className="text-zinc-500 text-xs mb-4">Direct message a friend or send a photo.</p>
                 <button 
                    onClick={onAddFriend}
                    className="text-[#3797F0] text-sm font-semibold"
                 >
                     Send message
                 </button>
             </div>
        ) : (
             users.map((user) => {
                const isUnread = (user.unreadCount || 0) > 0;
                
                return (
                <div
                    key={user.id}
                    onClick={() => onSelectUser(user.id)}
                    className={`px-5 py-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors ${
                    activeUserId === user.id ? 'bg-white/10' : ''
                    }`}
                >
                    <div className="relative">
                        <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-14 h-14 rounded-full object-cover border border-zinc-900"
                        />
                        {(user.isBot || user.isOnline) && (
                            <div className="absolute -bottom-1 -right-1 bg-black rounded-full p-[2px]">
                               <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-black"></div>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className={`text-white text-sm truncate ${isUnread ? 'font-bold' : 'font-normal'}`}>{user.name}</h3>
                        <div className={`flex gap-1 text-sm truncate ${isUnread ? 'text-white font-semibold' : 'text-zinc-400'}`}>
                            <span className="truncate">{user.lastMessage || (user.isOnline ? "Active now" : "Offline")}</span>
                            <span className="text-zinc-500">· {user.lastSeen || "1h"}</span>
                        </div>
                    </div>
                    
                    {isUnread && (
                        <div className="w-2.5 h-2.5 bg-[#3797F0] rounded-full mr-2 animate-pulse"></div>
                    )}
                    
                    <div 
                        onClick={(e) => handleQuickCam(e, user.id)}
                        className="text-zinc-500 cursor-pointer hover:text-white transition-colors p-2"
                    >
                        <svg aria-label="Camera" fill="currentColor" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M12 17.1c2.6 0 4.8-2.1 4.8-4.7V6.2c0-2.6-2.1-4.7-4.8-4.7S7.2 3.6 7.2 6.2v6.2c0 2.6 2.2 4.7 4.8 4.7z" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </div>
                </div>
                );
             })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
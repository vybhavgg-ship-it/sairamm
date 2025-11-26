import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { checkAvailability } from '../services/userService';
import { ShieldCheck, Camera, Lock, CheckCircle } from 'lucide-react';

interface AuthFlowProps {
  onComplete: (profile: UserProfile) => void;
}

const DEFAULT_AVATAR = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

const AuthFlow: React.FC<AuthFlowProps> = ({ onComplete }) => {
  const [error, setError] = useState('');
  
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [avatar, setAvatar] = useState<string>(DEFAULT_AVATAR);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatar(event.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !displayName || !password) {
      setError('All fields are required.');
      return;
    }
    if (password.length < 4) {
      setError('Passcode must be at least 4 digits.');
      return;
    }
    if (password !== confirmPass) {
      setError('Passcodes do not match.');
      return;
    }

    const availability = checkAvailability(username, displayName);
    if (!availability.available) {
      setError(availability.error || 'Username taken');
      return;
    }

    const profile: UserProfile = {
      email: `${username.toLowerCase()}@stealth.chat`, // Placeholder email since verification is removed
      username,
      displayName,
      password,
      avatar
    };

    onComplete(profile);
  };

  return (
    <div className="h-full w-full bg-animated relative flex flex-col items-center justify-center text-white p-6 overflow-hidden">
       <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>
       
       <div className="w-full max-w-md relative z-10">
         {/* Header */}
         <div className="text-center mb-8 animate-fade-in">
            <div className="inline-flex items-center justify-center p-4 bg-white/5 rounded-full border border-white/10 backdrop-blur-md shadow-xl mb-4">
              <ShieldCheck size={32} className="text-blue-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400">
              STEALTH<span className="font-light">chat</span>
            </h1>
            <p className="text-zinc-500 mt-2 text-sm">Secure. Encrypted. Anonymous.</p>
         </div>

         {/* Glass Card */}
         <div className="glass-panel rounded-2xl p-8 shadow-2xl animate-fade-in relative">
            
              <form onSubmit={handleComplete} className="space-y-5">
                 <div className="text-center mb-4">
                    <div className="relative w-24 h-24 mx-auto mb-3 group">
                        <img src={avatar} className="w-full h-full rounded-full object-cover border-2 border-zinc-700 group-hover:border-blue-500 transition-colors" alt="Avatar" />
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity backdrop-blur-sm"
                        >
                            <Camera size={24} />
                        </div>
                        <input type="file" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" accept="image/*" />
                    </div>
                    <h2 className="text-xl font-semibold">Create Account</h2>
                    <p className="text-zinc-400 text-xs">Setup your secret identity</p>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs text-zinc-400 ml-1">Display Name</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 px-3 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="Agent 47"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs text-zinc-400 ml-1">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 px-3 text-sm focus:border-blue-500 focus:outline-none"
                            placeholder="@ghost"
                        />
                    </div>
                 </div>

                 <div className="space-y-1">
                    <label className="text-xs text-zinc-400 ml-1">Secure Passcode (PIN)</label>
                    <div className="relative">
                        <Lock size={14} className="absolute left-3 top-3 text-zinc-500" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value.replace(/\D/g, '').slice(0,6))}
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none tracking-widest"
                            placeholder="PIN"
                        />
                    </div>
                 </div>
                 
                 <div className="space-y-1">
                    <label className="text-xs text-zinc-400 ml-1">Confirm PIN</label>
                    <div className="relative">
                        <CheckCircle size={14} className="absolute left-3 top-3 text-zinc-500" />
                        <input
                            type="password"
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value.replace(/\D/g, '').slice(0,6))}
                            className="w-full bg-black/50 border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none tracking-widest"
                            placeholder="PIN"
                        />
                    </div>
                 </div>

                 {error && <p className="text-red-400 text-xs bg-red-500/10 p-2 rounded border border-red-500/20">{error}</p>}

                 <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 mt-2"
                >
                  Initialize System
                </button>
              </form>
         </div>
       </div>
    </div>
  );
};

export default AuthFlow;
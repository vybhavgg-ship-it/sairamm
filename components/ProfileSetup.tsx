import React, { useState } from 'react';
import { User, ShieldCheck } from 'lucide-react';

interface ProfileSetupProps {
  onComplete: (username: string, pin: string) => void;
}

const ProfileSetup: React.FC<ProfileSetupProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (pin.length < 4) {
      setError('Passcode must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setError('Passcodes do not match');
      return;
    }
    onComplete(username, pin);
  };

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center text-white p-6 animate-fade-in">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-zinc-900 rounded-full flex items-center justify-center mb-4 border border-zinc-800 shadow-lg shadow-blue-900/20">
            <ShieldCheck size={32} className="text-blue-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight">Create Account</h2>
          <p className="mt-2 text-zinc-400">Set up your secret identity and passcode.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-300">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User size={18} className="text-zinc-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-lg py-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                placeholder="e.g. ShadowHunter"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Passcode</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center tracking-widest transition-all"
                placeholder="123456"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-300">Confirm</label>
              <input
                type="password"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                maxLength={6}
                className="w-full bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-lg py-3 px-4 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-center tracking-widest transition-all"
                placeholder="123456"
              />
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center bg-red-500/10 py-2 rounded animate-pulse">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg shadow-blue-600/20 mt-4"
          >
            Create Secret Account
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetup;
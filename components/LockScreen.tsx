import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';

interface LockScreenProps {
  onUnlock: () => void;
  expectedPass: string;
  onForgotPass: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock, expectedPass, onForgotPass }) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === expectedPass) {
        onUnlock();
    } else {
        setError(true);
        setTimeout(() => setError(false), 500);
        setInput("");
    }
  };

  return (
    <div className="h-full w-full bg-animated relative flex flex-col items-center justify-center text-white p-6 overflow-hidden">
      {/* Grid Overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20 pointer-events-none"></div>

      <div className="mb-8 flex flex-col items-center animate-fade-in relative z-10">
        <div className="p-5 bg-white/5 rounded-full mb-6 border border-white/10 shadow-xl shadow-black/40 backdrop-blur-sm">
          <Lock size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-br from-white to-zinc-400">Locked</h1>
        <p className="text-zinc-500 text-sm mt-2">Enter password to access secure chats</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-xs relative z-10">
          <div className="relative">
            <input 
                type="password"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={`w-full bg-black/40 backdrop-blur-md border text-center tracking-wider ${error ? 'border-red-500 animate-shake' : 'border-zinc-700 focus:border-blue-500'} rounded-full py-3.5 px-4 text-white placeholder-zinc-600 focus:outline-none transition-all shadow-lg`}
                placeholder="Password"
                autoFocus
            />
            <button 
                type="submit"
                className="absolute right-2 top-2 bg-zinc-700/50 p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-blue-600 transition-all"
            >
                <ArrowRight size={18} />
            </button>
          </div>
      </form>
      
      <div 
        onClick={onForgotPass}
        className="mt-8 text-zinc-600 text-xs cursor-pointer hover:text-red-400 transition-colors relative z-10"
      >
          Reset Account / Forgot Password?
      </div>
    </div>
  );
};

export default LockScreen;
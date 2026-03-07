import React, { useState } from 'react';
import { supabase } from './lib/supabase';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Registrazione completata! Ora puoi fare il login.');
        setIsLogin(true);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 px-4 selection:bg-white/30 selection:text-white">
      {/* Sfondo decorativo per accentuare l'effetto Glassmorphism */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-red-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl p-10 rounded-3xl shadow-2xl border border-white/10 relative z-10">
        <h2 className="text-4xl font-bold text-center text-white mb-2 drop-shadow-md tracking-tight">
          🍒 CilieginoFocus
        </h2>
        <p className="text-center text-neutral-400 mb-8 font-medium">
          {isLogin ? 'Bentornat* nella tua zona di focus' : 'Sincronizzati con il ritmo dellL\'obiettivo'}
        </p>
        
        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-neutral-300 mb-2 font-medium text-sm ml-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 bg-black/40 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 border border-white/10 placeholder-neutral-500 backdrop-blur-sm transition-all shadow-inner"
              placeholder="Inserisci la tua email"
              required
            />
          </div>
          <div>
            <label className="block text-neutral-300 mb-2 font-medium text-sm ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-black/40 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 border border-white/10 placeholder-neutral-500 backdrop-blur-sm transition-all shadow-inner"
              placeholder="Inserisci la tua password"
              required
            />
          </div>

          {message && (
            <div className={`text-sm text-center p-4 rounded-xl font-medium border backdrop-blur-md ${message.includes('completata') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-900/20 text-red-400 border-red-500/20'}`}>
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600/80 hover:bg-red-500 backdrop-blur-md border border-red-500/50 text-white py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Attendere...' : (isLogin ? 'Accedi al Timer' : 'Crea Account')}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage(''); // Pulisce i messaggi cambiando modalità
            }}
            className="text-neutral-400 hover:text-white text-sm font-medium transition-colors"
          >
            {isLogin ? (
              <span>Non hai un account? <span className="text-red-400 hover:underline">Registrati ora</span></span>
            ) : (
              <span>Hai già un account? <span className="text-red-400 hover:underline">Accedi qui</span></span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
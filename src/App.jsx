import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

const POMODORO_SECONDS = 1500;

// Motore logico della Mascotte (basato esclusivamente sui dati della stanza)
const getMascotStage = (roomMinutes) => {
  const xp = roomMinutes; // 1 minuto di focus nella stanza = 1 XP
  
  const stages = [
    { minXp: 0, name: 'Seme Dormiente', visual: '🟤', color: 'text-amber-700' },
    { minXp: 50, name: 'Germoglio', visual: '🌱', color: 'text-emerald-400' },
    { minXp: 150, name: 'Piantina', visual: '🌿', color: 'text-emerald-500' },
    { minXp: 300, name: 'Pomodorino Verde', visual: '🍏', color: 'text-lime-400' },
    { minXp: 600, name: 'Ciliegino Rosso', visual: '🍅', color: 'text-red-500' },
    { minXp: 1000, name: 'Re Supremo', visual: '👑', color: 'text-yellow-400' }
  ];

  let currentStageIndex = 0;
  for (let i = 0; i < stages.length; i++) {
    if (xp >= stages[i].minXp) {
      currentStageIndex = i;
    }
  }

  const stage = stages[currentStageIndex];
  const isMaxLevel = currentStageIndex === stages.length - 1;
  const nextStage = isMaxLevel ? stage : stages[currentStageIndex + 1]; 
  
  const level = Math.floor(xp / 25) + 1;
  
  let progress = 100;
  let xpNeeded = 0;
  
  if (!isMaxLevel) {
    const xpInCurrentStage = xp - stage.minXp;
    xpNeeded = nextStage.minXp - stage.minXp;
    progress = (xpInCurrentStage / xpNeeded) * 100;
  }

  return {
    ...stage,
    level,
    xp,
    nextXp: isMaxLevel ? 'MAX' : nextStage.minXp,
    progress: Math.min(100, Math.max(0, progress)),
    isMaxLevel
  };
};

function App() {
  const [session, setSession] = useState(null);
  
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomCreator, setRoomCreator] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);

  // Nuovi stati per modalità e gestione tempo personalizzato
  const [customMinutes, setCustomMinutes] = useState(25);

  const [timeLeft, setTimeLeft] = useState(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState('study'); // 'study' o 'break'
  const [roomSettings, setRoomSettings] = useState({ studyDuration: 25, breakDuration: 5, autoSwitch: false });
  const [showSettings, setShowSettings] = useState(false);

  const [personalStats, setPersonalStats] = useState({ pomodoros: 0, totalMinutes: 0 });
  const [roomStats, setRoomStats] = useState({ pomodoros: 0, totalMinutes: 0 });
  const [globalStats, setGlobalStats] = useState({ pomodoros: 0, totalMinutes: 0 });

  const updateRoomTimer = async (seconds, running, currentMode) => {
    if (!currentRoom) return;
    await supabase.from('pomodoro_sessions').update({
      seconds_left: seconds,
      is_running: running,
      mode: currentMode,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);
  };
  
  const applyAndSaveSettings = async () => {
    let newTime = timeLeft;

    // Se il timer è FERMO, calcola e applica subito il nuovo tempo
    if (!isRunning) {
      newTime = mode === 'study' ? roomSettings.studyDuration * 60 : roomSettings.breakDuration * 60;
      setTimeLeft(newTime);
    }

    // Invia i dati a Supabase UNA SOLA VOLTA. 
    // Questo aggiornerà istantaneamente lo schermo di tutti gli utenti connessi!
    await supabase.from('pomodoro_sessions').update({
      study_duration: roomSettings.studyDuration,
      break_duration: roomSettings.breakDuration,
      auto_switch: roomSettings.autoSwitch,
      seconds_left: newTime,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);

    // Chiude il popup
    setShowSettings(false);
  };

  const switchMode = (newMode) => {
    const defaultSecs = newMode === 'study' ? roomSettings.studyDuration * 60 : roomSettings.breakDuration * 60;
    setMode(newMode);
    setTimeLeft(defaultSecs);
    setIsRunning(false);
    updateRoomTimer(defaultSecs, false, newMode);
  };

  const toggleTimer = async () => {
    const newIsRunning = !isRunning;
    setIsRunning(newIsRunning);
    updateRoomTimer(timeLeft, newIsRunning, mode);
  };

  const resetTimer = async () => {
    setIsRunning(false);
    const secs = mode === 'study' ? roomSettings.studyDuration * 60 : roomSettings.breakDuration * 60;
    setTimeLeft(secs);
    await supabase.from('pomodoro_sessions').update({
      is_running: false,
      seconds_left: secs,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);
  };

  const handlePomodoroComplete = async () => {
    setIsRunning(false);
    clearInterval(timerRef.current);

    if (mode === 'study') {
      await supabase.from('study_history').insert([{
        user_id: session.user.id,
        room_name: currentRoom,
        duration_minutes: roomSettings.studyDuration
      }]);
    }

    const nextMode = mode === 'study' ? 'break' : 'study';
    const nextDuration = nextMode === 'study' ? roomSettings.studyDuration : roomSettings.breakDuration;
    const nextSeconds = nextDuration * 60;
    const shouldAutoStart = roomSettings.autoSwitch;

    setMode(nextMode);
    setTimeLeft(nextSeconds);
    setIsRunning(shouldAutoStart);

    await supabase.from('pomodoro_sessions').update({
      mode: nextMode,
      seconds_left: nextSeconds,
      is_running: shouldAutoStart,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);

    fetchStats();

    if (!shouldAutoStart) {
      alert(mode === 'study' ? "Sessione completata! Inizia la pausa." : "Pausa terminata! Torna a studiare.");
    }
  };




  
  const timerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && !currentRoom) {
      fetchRooms();
      fetchGlobalStats();
    }
  }, [session, currentRoom]);

  const fetchRooms = async () => {
    const { data } = await supabase
      .from('pomodoro_sessions')
      .select('room_name, created_by')
      .order('last_updated_at', { ascending: false });
    
    if (data) setRooms(data);
  };

  const fetchGlobalStats = async () => {
    const { data } = await supabase
      .from('study_history')
      .select('duration_minutes')
      .eq('user_id', session.user.id);
    
    if (data) {
      setGlobalStats({
        pomodoros: data.length,
        totalMinutes: data.reduce((acc, curr) => acc + curr.duration_minutes, 0)
      });
    }
  };

  const joinRoom = async (roomName) => {
    if (!roomName.trim()) return;
    const cleanName = roomName.trim();

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('room_name', cleanName)
      .single();

    if (error && error.code === 'PGRST116') {
      await supabase.from('pomodoro_sessions').insert([{
        room_name: cleanName,
        created_by: session.user.id,
        seconds_left: 1500,
        mode: 'study',
        study_duration: 25,
        break_duration: 5,
        auto_switch: false
      }]);
    }
    
    setCurrentRoom(cleanName);
    setNewRoomName('');
  };

  const deleteRoom = async () => {
    const input = window.prompt(`Per eliminare definitivamente la stanza, digita il suo nome esatto: "${currentRoom}"`);
    
    if (input !== currentRoom) {
      if (input !== null) {
        alert("Il nome inserito non corrisponde. Eliminazione annullata.");
      }
      return;
    }

    await supabase
      .from('pomodoro_sessions')
      .delete()
      .eq('room_name', currentRoom);
      
    leaveRoom();
  };

  const leaveRoom = () => {
    setCurrentRoom(null);
    setIsRunning(false);
    setTimeLeft(POMODORO_SECONDS);
    setOnlineUsers([]);
    setRoomCreator(null);
    clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!currentRoom) return;

    const initializeRoom = async () => {
      const { data } = await supabase.from('pomodoro_sessions').select('*').eq('room_name', currentRoom).single();
      if (data) {
        setTimeLeft(data.seconds_left);
        setIsRunning(data.is_running);
        setMode(data.mode || 'study');
        setRoomCreator(data.created_by);
        setRoomSettings({
          studyDuration: data.study_duration || 25,
          breakDuration: data.break_duration || 5,
          autoSwitch: data.auto_switch || false
        });
      }
      fetchStats();
    };

    initializeRoom();

    const roomSubscription = supabase.channel(`room-${currentRoom}`, {
      config: {
        presence: {
          key: session.user.email,
        },
      },
    });

    roomSubscription
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pomodoro_sessions', filter: `room_name=eq.${currentRoom}` }, (payload) => {
        setTimeLeft(payload.new.seconds_left);
        setIsRunning(payload.new.is_running);
        setMode(payload.new.mode || 'study');
        setRoomSettings({
          studyDuration: payload.new.study_duration || 25,
          breakDuration: payload.new.break_duration || 5,
          autoSwitch: payload.new.auto_switch || false
        });
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = roomSubscription.presenceState();
        const users = Object.keys(presenceState).map(key => presenceState[key][0].user_email);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await roomSubscription.track({ user_email: session.user.email });
        }
      });

    return () => {
      roomSubscription.untrack();
      supabase.removeChannel(roomSubscription);
    };
  }, [currentRoom]);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handlePomodoroComplete();
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, timeLeft]);





  const fetchStats = async () => {
    const { data: personalData } = await supabase
      .from('study_history')
      .select('duration_minutes')
      .eq('user_id', session.user.id);

    const { data: roomData } = await supabase
      .from('study_history')
      .select('duration_minutes')
      .eq('room_name', currentRoom);

    const calcStats = (data) => ({
      pomodoros: data ? data.length : 0,
      totalMinutes: data ? data.reduce((acc, curr) => acc + curr.duration_minutes, 0) : 0
    });

    setPersonalStats(calcStats(personalData));
    setRoomStats(calcStats(roomData));
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!session) return <Auth />;

  // Genera lo stato corrente della mascotte passando ESCLUSIVAMENTE i minuti della stanza
  const mascot = getMascotStage(roomStats.totalMinutes);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col selection:bg-white/30 selection:text-white">
    
    {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
          <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-sm">
            <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">Impostazioni Stanza</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-400 mb-2 uppercase tracking-widest">Durata Studio (min)</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setRoomSettings({...roomSettings, studyDuration: Math.max(1, roomSettings.studyDuration - 1)})} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg text-xl transition-colors">-</button>
                  <span className="text-2xl font-bold flex-1 text-center">{roomSettings.studyDuration}</span>
                  <button onClick={() => setRoomSettings({...roomSettings, studyDuration: roomSettings.studyDuration + 1})} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg text-xl transition-colors">+</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-neutral-400 mb-2 uppercase tracking-widest">Durata Pausa (min)</label>
                <div className="flex items-center gap-4">
                  <button onClick={() => setRoomSettings({...roomSettings, breakDuration: Math.max(1, roomSettings.breakDuration - 1)})} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg text-xl transition-colors">-</button>
                  <span className="text-2xl font-bold flex-1 text-center">{roomSettings.breakDuration}</span>
                  <button onClick={() => setRoomSettings({...roomSettings, breakDuration: roomSettings.breakDuration + 1})} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-lg text-xl transition-colors">+</button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Passaggio Automatico</label>
                <button 
                  onClick={() => setRoomSettings({...roomSettings, autoSwitch: !roomSettings.autoSwitch})}
                  className={`w-14 h-8 rounded-full transition-colors relative ${roomSettings.autoSwitch ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${roomSettings.autoSwitch ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>
            </div>

            <button onClick={applyAndSaveSettings} className="w-full mt-8 py-4 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95">Chiudi e Applica</button>
          </div>
        </div>
      )}

      <nav className="bg-black/40 backdrop-blur-lg border-b border-white/10 p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-wider flex items-center gap-2 drop-shadow-lg text-white">
            🍒 CilieginoFocus
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm bg-white/10 border border-white/20 backdrop-blur-md px-4 py-1.5 rounded-full font-medium shadow-inner">
              {session.user.email}
            </div>
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-400 hover:text-red-300 hover:underline font-semibold transition-colors">
              Esci
            </button>
          </div>
        </div>
      </nav>

      {!currentRoom ? (
        <main className="max-w-4xl mx-auto mt-12 p-4 w-full">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-2xl font-bold mb-2 text-white drop-shadow-md">Riepilogo Personale</h2>
              <p className="text-neutral-400">Totale accumulato in tutte le stanze</p>
            </div>
            <div className="flex gap-8 text-center bg-black/30 border border-white/5 backdrop-blur-md p-5 rounded-2xl w-full md:w-auto shadow-inner">
              <div>
                <span className="block text-4xl font-bold text-white drop-shadow-lg">{globalStats.pomodoros}</span>
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 block">Pomodori</span>
              </div>
              <div className="w-px bg-white/10"></div>
              <div>
                <span className="block text-4xl font-bold text-white drop-shadow-lg">{(globalStats.totalMinutes / 60).toFixed(1)}h</span>
                <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 block">Ore totali</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-8">
            <h2 className="text-2xl font-bold mb-5 text-white drop-shadow-md">Crea una nuova stanza</h2>
            <div className="flex gap-4">
              <input
                type="text"
                placeholder="Nome della stanza (es. EsameFisica)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="flex-1 px-5 py-4 bg-black/40 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 border border-white/10 placeholder-neutral-500 backdrop-blur-sm transition-all shadow-inner"
              />
              <button 
                onClick={() => joinRoom(newRoomName)}
                className="bg-red-600/80 hover:bg-red-500 backdrop-blur-md border border-red-500/50 text-white px-8 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95"
              >
                Crea / Entra
              </button>
            </div>
          </div>

          <h2 className="text-xl font-bold text-neutral-300 mb-5 px-2">Stanze Attive</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {rooms.length === 0 ? (
              <p className="text-neutral-500 px-2">Nessuna stanza disponibile. Creane una nuova!</p>
            ) : (
              rooms.map((room, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-lg p-6 rounded-2xl border border-white/10 flex justify-between items-center hover:bg-white/10 transition-all shadow-lg group">
                  <span className="font-bold text-lg text-white group-hover:drop-shadow-md transition-all">{room.room_name}</span>
                  <button 
                    onClick={() => joinRoom(room.room_name)}
                    className="bg-red-600/80 hover:bg-red-500 backdrop-blur-md border border-red-500/50 text-white px-5 py-2.5 rounded-lg font-semibold transition-all text-sm shadow-md active:scale-95"
                  >
                    Entra
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      ) : (
        <main className="max-w-4xl mx-auto mt-8 p-4 w-full grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
          <div className="md:col-span-3 mb-2 flex justify-between items-center bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-lg">
            <div className="flex items-center gap-4">
              <button 
                onClick={leaveRoom}
                className="text-neutral-300 hover:text-white flex items-center gap-2 transition-colors font-medium px-2 py-1"
              >
                ← Torna alla Lobby
              </button>
              
              {roomCreator === session.user.id && (
                <div className="w-px h-6 bg-white/20 mx-2"></div>
              )}
              {roomCreator === session.user.id && (
                <button 
                  onClick={deleteRoom}
                  className="bg-red-900/80 hover:bg-red-800 backdrop-blur-md border border-red-500/30 text-red-100 px-4 py-2 rounded-lg font-semibold transition-all text-sm shadow-md active:scale-95"
                >
                  Elimina Stanza
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-xl border border-emerald-500/30 shadow-inner">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-sm font-bold text-emerald-400 tracking-wide">
                {onlineUsers.length} {onlineUsers.length === 1 ? 'Connesso' : 'Connessi'}
              </span>
            </div>
          </div>

            <div className="md:col-span-2 flex flex-col gap-6">
              <div className="bg-white/5 backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl text-center relative overflow-hidden">

                <div className="flex justify-between items-start mb-8 z-10 relative w-full">
                  <div className="flex gap-4">
                    <button onClick={() => switchMode('study')} className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${mode === 'study' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'bg-white/5 text-neutral-400'}`}>STUDIO</button>
                    <button onClick={() => switchMode('break')} className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${mode === 'break' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white/5 text-neutral-400'}`}>PAUSA</button>
                  </div>

                  <button
                    onClick={() => setShowSettings(true)}
                    className="w-12 h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-xl"
                    title="Impostazioni Timer"
                  >
                    ⚙️
                  </button>
                </div>

                <div className="text-[120px] font-mono font-bold leading-none tracking-tighter mb-12 drop-shadow-2xl">
                  {formatTime(timeLeft)}
                </div>

                <div className="flex gap-4 max-w-md mx-auto z-10 relative">
                  <button onClick={toggleTimer} className={`flex-1 py-5 rounded-2xl font-bold text-xl transition-all shadow-lg active:scale-95 border ${isRunning ? 'bg-amber-500 text-black border-amber-400' : 'bg-white text-black border-white'}`}>
                    {isRunning ? 'PAUSA' : 'AVVIA'}
                  </button>
                  <button onClick={resetTimer} className="px-8 py-5 bg-white/10 hover:bg-white/20 rounded-2xl font-bold border border-white/10 transition-all active:scale-95">RESET</button>
                </div>
              </div>
            </div>

          <div className="flex flex-col gap-6">
            
            {/* COMPONENTE MASCOTTE (Omino Ciliegino) */}
            <div className="bg-white/5 backdrop-blur-xl p-7 rounded-3xl border border-white/10 shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
              
              <h3 className="text-sm font-bold text-neutral-400 mb-5 border-b border-white/10 pb-3 uppercase tracking-widest">
                Ciliegino della Stanza
              </h3>
              
              <div className="flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-3 filter drop-shadow-xl animate-bounce" style={{ animationDuration: '3s' }}>
                  {mascot.visual}
                </div>
                <h4 className={`text-xl font-bold ${mascot.color} drop-shadow-md`}>
                  {mascot.name}
                </h4>
                <div className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 mb-5">
                  Livello {mascot.level}
                </div>

                <div className="w-full bg-black/40 rounded-full h-3 border border-white/5 shadow-inner relative overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-red-600 to-red-400 h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${mascot.progress}%` }}
                  ></div>
                </div>
                
                <div className="flex justify-between w-full mt-2 text-xs font-medium text-neutral-500">
                  <span>{mascot.xp} XP</span>
                  <span>{mascot.isMaxLevel ? 'MAX' : `${mascot.nextXp} XP`}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-xl p-7 rounded-3xl border border-white/10 shadow-xl">
              <h3 className="text-sm font-bold text-emerald-400 mb-5 border-b border-white/10 pb-3 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connessi Ora
              </h3>
              <ul className="space-y-3 text-sm text-neutral-300 font-medium">
                {onlineUsers.map((email, idx) => (
                  <li key={idx} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50 text-xs text-emerald-400 font-bold">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    {email}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white/5 backdrop-blur-xl p-7 rounded-3xl border border-white/10 shadow-xl">
              <h3 className="text-sm font-bold text-neutral-400 mb-5 border-b border-white/10 pb-3 uppercase tracking-widest">
                Statistiche Stanza
              </h3>
              <div className="space-y-4 text-neutral-300">
                <p className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="font-medium">Pomodori:</span> 
                  <span className="font-bold text-white text-lg bg-white/10 px-3 py-1 rounded-lg border border-white/10">{roomStats.pomodoros}</span>
                </p>
                <p className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                  <span className="font-medium">Minuti:</span> 
                  <span className="font-bold text-white text-lg bg-white/10 px-3 py-1 rounded-lg border border-white/10">{roomStats.totalMinutes}</span>
                </p>
              </div>
            </div>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
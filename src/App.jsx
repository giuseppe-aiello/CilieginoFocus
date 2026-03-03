import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Auth from './Auth';

const POMODORO_SECONDS = 1500;

// Motore logico della Mascotte (basato esclusivamente sui dati della stanza)
const getMascotStage = (roomSeconds) => {
  const xp = Math.floor(roomSeconds / 60); // 60 secondi di focus nella stanza = 1 XP
  
  
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


const PIXEL_FRUITS = {
  pomodoro: [
    [0, 0, 1, 1, 0, 0],
    [0, 2, 2, 2, 2, 0],
    [2, 2, 2, 2, 2, 2],
    [2, 2, 2, 2, 2, 2],
    [0, 2, 2, 2, 2, 0],
  ],
  mela_verde: [
    [0, 0, 1, 0, 0, 0],
    [0, 3, 3, 3, 3, 0],
    [3, 3, 3, 3, 3, 3],
    [3, 3, 3, 3, 3, 3],
    [0, 3, 3, 3, 3, 0],
  ],
  limone: [
    [0, 0, 0, 0, 0, 0],
    [0, 4, 4, 4, 4, 0],
    [4, 4, 4, 4, 4, 4],
    [4, 4, 4, 4, 4, 4],
    [0, 4, 4, 4, 4, 0],
  ],
  ciliegie: [
    [0, 0, 1, 0, 1, 0], // Sommità dei gambi
    [0, 1, 0, 1, 0, 0], // Gambi che scendono
    [5, 5, 0, 5, 5, 0], // Parte superiore dei frutti
    [5, 5, 5, 5, 5, 5], // Corpo dei frutti
    [0, 5, 5, 0, 5, 5], // Base dei frutti
  ],
  uva: [
    [0, 0, 1, 1, 0, 0], // Picciolo
    [0, 6, 6, 6, 6, 0], // Parte superiore grappolo
    [6, 6, 6, 6, 6, 6], // Corpo del grappolo
    [0, 6, 6, 6, 6, 0], // Si stringe
    [0, 0, 6, 6, 0, 0], // Punta del grappolo
  ]  
};

const COLOR_MAP = {
  0: 'transparent',
  1: '#166534', // Verde scuro (steli/picciolo)
  2: '#ef4444', // Rosso pomodoro
  3: '#4ade80', // Verde mela
  4: '#facc15', // Giallo limone
  5: '#991b1b', // Rosso ciliegia (Bordeaux)
  6: '#8b5cf6', // Viola uva (Violet)
};

const PixelAvatar = ({ type, size = "w-12" }) => {
  const pixels = PIXEL_FRUITS[type] || PIXEL_FRUITS.ciliegie;

  return (
    <div
      className={`${size} grid grid-cols-6 gap-0.5`}
      style={{
        aspectRatio: '6 / 5',
        height: 'auto' // Impedisce a classi come h-12 di distorcere l'altezza
      }}
    >
      {pixels.flat().map((colorIdx, i) => (
        <div
          key={i}
          style={{ backgroundColor: COLOR_MAP[colorIdx] }}
          className="rounded-sm"
        />
      ))}
    </div>
  );
};

const alarmSound = new Audio('/rooster.wav');

function App() {


  //States
  const [profile, setProfile] = useState({ nickname: '', avatar_id: 'pomodoro' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [session, setSession] = useState(null);

  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [roomCreator, setRoomCreator] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);

  // Nuovi stati per la logica a timestamp assoluto
  const [timeLeft, setTimeLeft] = useState(1500); // Variabile puramente visiva
  const [isRunning, setIsRunning] = useState(false);
  const [targetEndTime, setTargetEndTime] = useState(null);
  const [pausedRemainingSec, setPausedRemainingSec] = useState(1500);

  const [mode, setMode] = useState('study'); // 'study' o 'break'

  // Impostazioni e statistiche ora ragionano nativamente in secondi
  const [roomSettings, setRoomSettings] = useState({ studyDurationSec: 1500, breakDurationSec: 300, autoSwitch: false });
  const [showSettings, setShowSettings] = useState(false);

  const [personalStats, setPersonalStats] = useState({ pomodoros: 0, totalSeconds: 0 });
  const [roomStats, setRoomStats] = useState({ pomodoros: 0, totalSeconds: 0 });
  const [globalStats, setGlobalStats] = useState({ pomodoros: 0, totalSeconds: 0 });


  useEffect(() => {
    if (showSettings) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Pulizia in caso il componente venga smontato mentre il modale è aperto
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showSettings]);

  useEffect(() => {
    if (session) fetchProfile();
  }, [session]);



  const fetchProfile = async () => {
    if (!session?.user) return; // Protezione: esce se non c'è l'utente
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (data) {
      setProfile({ nickname: data.nickname || '', avatar_id: data.avatar_id || 'pomodoro' });
    }
  };

  const saveProfile = async () => {
    await supabase.from('profiles').upsert({
      id: session.user.id,
      nickname: profile.nickname,
      avatar_id: profile.avatar_id,
      updated_at: new Date()
    });
    setIsEditingProfile(false);
  };



  const applyAndSaveSettings = async () => {
    let newRemaining = pausedRemainingSec;

    if (!isRunning) {
      newRemaining = mode === 'study' ? roomSettings.studyDurationSec : roomSettings.breakDurationSec;
      setPausedRemainingSec(newRemaining);
      setTimeLeft(newRemaining);
    }

    await supabase.from('pomodoro_sessions').update({
      study_duration_sec: roomSettings.studyDurationSec,
      break_duration_sec: roomSettings.breakDurationSec,
      auto_switch: roomSettings.autoSwitch,
      paused_remaining_sec: newRemaining,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);

    setShowSettings(false);
  };

  const switchMode = async (newMode) => {
    const defaultSecs = newMode === 'study' ? roomSettings.studyDurationSec : roomSettings.breakDurationSec;
    setMode(newMode);
    setTimeLeft(defaultSecs);
    setIsRunning(false);
    setPausedRemainingSec(defaultSecs);
    setTargetEndTime(null);

    await supabase.from('pomodoro_sessions').update({
      is_running: false,
      mode: newMode,
      target_end_time: null,
      paused_remaining_sec: defaultSecs,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);
  };

  const toggleTimer = async () => {
    const newIsRunning = !isRunning;
    setIsRunning(newIsRunning);

    let newTarget = null;
    let newPausedSec = pausedRemainingSec;

    if (newIsRunning) {
      // PLAY: Calcola l'ora esatta in cui il timer scadrà
      newTarget = new Date(Date.now() + pausedRemainingSec * 1000).toISOString();
      setTargetEndTime(newTarget);
    } else {
      // PAUSA: Calcola quanti secondi mancavano al traguardo
      const remaining = targetEndTime
        ? Math.max(0, Math.ceil((new Date(targetEndTime).getTime() - Date.now()) / 1000))
        : pausedRemainingSec;

      newPausedSec = remaining;
      setPausedRemainingSec(remaining);
      setTimeLeft(remaining);
      setTargetEndTime(null);
    }

    await supabase.from('pomodoro_sessions').update({
      is_running: newIsRunning,
      target_end_time: newTarget,
      paused_remaining_sec: newPausedSec,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);
  };


  const resetTimer = async () => {
    clearInterval(timerRef.current);
    setIsRunning(false);

    // Definisce i valori standard fissi
    const STANDARD_STUDY = 1500; // 25 min
    const STANDARD_BREAK = 300;  // 5 min

    // Sceglie il valore in base alla modalità attuale
    const forcedDefaultSecs = mode === 'study' ? STANDARD_STUDY : STANDARD_BREAK;

    // Aggiorna lo stato locale
    setTimeLeft(forcedDefaultSecs);
    setPausedRemainingSec(forcedDefaultSecs);
    setTargetEndTime(null);

    // Aggiorna il database per sincronizzare tutti gli utenti della stanza
    await supabase.from('pomodoro_sessions').update({
      is_running: false,
      target_end_time: null,
      paused_remaining_sec: forcedDefaultSecs,
      // Opzionale: se vuoi che il reset ripristini anche le impostazioni della stanza
      study_duration_sec: STANDARD_STUDY,
      break_duration_sec: STANDARD_BREAK,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);
  };

  const handlePomodoroComplete = async () => {
    setIsRunning(false);
    clearInterval(timerRef.current);

    // RIPRODUZIONE AUDIO A FINE TIMER
    try {
      alarmSound.currentTime = 0; // Ripristina l'audio all'inizio
      alarmSound.play();
    } catch (error) {
      console.error("Il browser ha bloccato l'audio in autoplay:", error);
    }

    // Notifica Web nativa (Popup di sistema)
    if ('Notification' in window && Notification.permission === 'granted') {
      const isStudy = mode === 'study';
      const notifTitle = isStudy ? "Sessione Terminata! BRAVO CICCIOBARULLA 🍅" : "Pausa Finita! Adesso è ora di studiare cicciobarulla... 📚";
      const notifBody = isStudy
        ? "Ottimo lavoro! Goditi i tuoi minuti di pausa."
        : "Pausa terminata. È ora di tornare a concentrarsi.";

      new Notification(notifTitle, {
        body: notifBody,
        icon: '/favicon.ico'
      });
    }
    

    if (mode === 'study') {
      await supabase.from('study_history').insert([{
        user_id: session.user.id,
        room_name: currentRoom,
        duration_seconds: roomSettings.studyDurationSec
      }]);
    }

    const nextMode = mode === 'study' ? 'break' : 'study';
    const nextDurationSec = nextMode === 'study' ? roomSettings.studyDurationSec : roomSettings.breakDurationSec;
    const shouldAutoStart = roomSettings.autoSwitch;

    let newTarget = null;
    if (shouldAutoStart) {
      newTarget = new Date(Date.now() + nextDurationSec * 1000).toISOString();
      setTargetEndTime(newTarget);
    }

    setMode(nextMode);
    setPausedRemainingSec(nextDurationSec);
    setTimeLeft(nextDurationSec);
    setIsRunning(shouldAutoStart);

    await supabase.from('pomodoro_sessions').update({
      mode: nextMode,
      is_running: shouldAutoStart,
      target_end_time: newTarget,
      paused_remaining_sec: nextDurationSec,
      last_updated_at: new Date()
    }).eq('room_name', currentRoom);

    fetchStats();

    if (!shouldAutoStart) {
      alert(mode === 'study' ? "Sessione completata! Inizia la pausa." : "Pausa terminata! Torna a studiare.");
    }
  };


  const updateSettingTime = (key, deltaSec) => {
    setRoomSettings(prev => ({
      ...prev,
      // Applica la variazione e impedisce che il timer scenda sotto 1 secondo
      [key]: Math.max(1, prev[key] + deltaSec)
    }));
  };

  const handleManualInput = (key, minutesStr, secondsStr) => {
    // Converte il testo in numeri ignorando i caratteri non validi
    const m = Math.max(0, parseInt(minutesStr) || 0);
    const s = Math.max(0, parseInt(secondsStr) || 0);
    const totalSec = m * 60 + s;

    setRoomSettings(prev => ({
      ...prev,
      [key]: Math.max(1, totalSec)
    }));
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

      // Mantiene la lobby aggiornata in tempo reale per tutti gli utenti
      const lobbySubscription = supabase.channel('public:pomodoro_sessions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, () => {
          fetchRooms();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(lobbySubscription);
      };
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
    if (!session?.user) return; // Protezione
    const { data } = await supabase
      .from('study_history')
      .select('duration_seconds')
      .eq('user_id', session.user.id);

    if (data) {
      setGlobalStats({
        pomodoros: data.length,
        totalSeconds: data.reduce((acc, curr) => acc + curr.duration_seconds, 0)
      });
    }
  };

  const joinRoom = async (roomName) => {

    // Richiesta permessi notifica al click dell'utente
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      try {
        await Notification.requestPermission();
      } catch (error) {
        console.error("Errore richiesta notifiche:", error);
      }
    }

    if (!roomName.trim()) return;
    const cleanName = roomName.trim();

    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .eq('room_name', cleanName)
      .single();

    if (error && error.code === 'PGRST116') {
      // Tenta di creare la stanza e cattura l'errore
      const { error: insertError } = await supabase.from('pomodoro_sessions').insert([{
        room_name: cleanName,
        created_by: session.user.id,
        mode: 'study',
        study_duration_sec: 1500,
        break_duration_sec: 300,
        paused_remaining_sec: 1500,
        target_end_time: null,
        auto_switch: false
      }]);

      // Se c'è un errore, blocca l'utente e stampa il problema
      if (insertError) {
        console.error("ERRORE DATABASE DURANTE LA CREAZIONE:", insertError);
        alert(`Errore database: ${insertError.message}`);
        return;
      }
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
    setPausedRemainingSec(POMODORO_SECONDS);
    setTargetEndTime(null);
    setOnlineUsers([]);
    setRoomCreator(null);
    clearInterval(timerRef.current);
  };

  useEffect(() => {
    if (!currentRoom) return;

    const initializeRoom = async () => {
      const { data } = await supabase.from('pomodoro_sessions').select('*').eq('room_name', currentRoom).single();
      if (data) {
        setMode(data.mode || 'study');
        setRoomCreator(data.created_by);
        setRoomSettings({
          studyDurationSec: data.study_duration_sec || 1500,
          breakDurationSec: data.break_duration_sec || 300,
          autoSwitch: data.auto_switch || false
        });

        setIsRunning(data.is_running);
        setTargetEndTime(data.target_end_time);
        setPausedRemainingSec(data.paused_remaining_sec);

        if (data.is_running && data.target_end_time) {
          const remaining = Math.max(0, Math.ceil((new Date(data.target_end_time).getTime() - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft(data.paused_remaining_sec);
        }
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
        setIsRunning(payload.new.is_running);
        setMode(payload.new.mode || 'study');
        setTargetEndTime(payload.new.target_end_time);
        setPausedRemainingSec(payload.new.paused_remaining_sec);

        setRoomSettings({
          studyDurationSec: payload.new.study_duration_sec || 1500,
          breakDurationSec: payload.new.break_duration_sec || 300,
          autoSwitch: payload.new.auto_switch || false
        });

        if (payload.new.is_running && payload.new.target_end_time) {
          const remaining = Math.max(0, Math.ceil((new Date(payload.new.target_end_time).getTime() - Date.now()) / 1000));
          setTimeLeft(remaining);
        } else {
          setTimeLeft(payload.new.paused_remaining_sec);
        }
      })
      // Correzione del mapping degli utenti online
      .on('presence', { event: 'sync' }, () => {
        const presenceState = roomSubscription.presenceState();
        // Estraiamo l'intero oggetto (nickname, avatar_id, user_email) memorizzato nel track
        const users = Object.keys(presenceState).map(key => presenceState[key][0]);
        setOnlineUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // IMPORTANTE: Assicurati che il profilo sia caricato prima di tracciare
          await roomSubscription.track({
            user_email: session.user.email,
            nickname: profile.nickname || 'Studente',
            avatar_id: profile.avatar_id || 'pomodoro'
          });
        }
      });

    return () => {
      roomSubscription.untrack();
      supabase.removeChannel(roomSubscription);
    };
  }, [currentRoom]);

  useEffect(() => {
    if (isRunning && targetEndTime) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((new Date(targetEndTime).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);

        if (remaining <= 0) {
          clearInterval(timerRef.current);
          handlePomodoroComplete();
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      setTimeLeft(pausedRemainingSec);
    }

    return () => clearInterval(timerRef.current);
  }, [isRunning, targetEndTime, pausedRemainingSec]);




  const fetchStats = async () => {
    const { data: personalData } = await supabase
      .from('study_history')
      .select('duration_seconds')
      .eq('user_id', session.user.id);

    const { data: roomData } = await supabase
      .from('study_history')
      .select('duration_seconds')
      .eq('room_name', currentRoom);

    const calcStats = (data) => ({
      pomodoros: data ? data.length : 0,
      totalSeconds: data ? data.reduce((acc, curr) => acc + curr.duration_seconds, 0) : 0
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

  // Genera lo stato corrente della mascotte passando ESCLUSIVAMENTE i secondi della stanza
  const mascot = getMascotStage(roomStats.totalSeconds);

  

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans flex flex-col selection:bg-white/30 selection:text-white">

      {showSettings && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-md px-4 overflow-y-auto py-8">
          <div className="bg-neutral-900 border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-w-md my-auto">
            <h2 className="text-2xl font-bold mb-8 text-white border-b border-white/10 pb-4 text-center">Impostazioni Stanza</h2>

            <div className="space-y-10">

              {/* SEZIONE DURATA STUDIO */}
              <div>
                <label className="block text-sm font-bold text-neutral-400 mb-4 uppercase tracking-widest text-center">Durata Studio</label>

                {/* Input manuale (Minuti : Secondi) */}
                <div className="flex items-center justify-center gap-3 mb-6 text-4xl font-bold">
                  {/* Minuti Studio */}
                  <input
                    type="number"
                    min="0"
                    value={Math.floor(roomSettings.studyDurationSec / 60).toString().padStart(2, '0')}
                    onChange={(e) => handleManualInput('studyDurationSec', e.target.value, roomSettings.studyDurationSec % 60)}
                    className="w-24 bg-black/40 text-center border border-white/10 rounded-2xl py-2 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  />

                  {/* Secondi Studio */}
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={(roomSettings.studyDurationSec % 60).toString().padStart(2, '0')}
                    onChange={(e) => handleManualInput('studyDurationSec', Math.floor(roomSettings.studyDurationSec / 60), e.target.value)}
                    className="w-24 bg-black/40 text-center border border-white/10 rounded-2xl py-2 focus:ring-1 focus:ring-red-500 outline-none transition-all"
                  />
                </div>

                {/* Bottoni Rapidi: Minuti */}
                <div className="flex justify-center gap-2 mb-3">
                  <button onClick={() => updateSettingTime('studyDurationSec', -600)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">-10m</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', -300)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">-5m</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', 300)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">+5m</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', 600)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">+10m</button>
                </div>

                {/* Bottoni Rapidi: Secondi */}
                <div className="flex justify-center gap-2">
                  <button onClick={() => updateSettingTime('studyDurationSec', -30)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">-30s</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', -10)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">-10s</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', 10)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">+10s</button>
                  <button onClick={() => updateSettingTime('studyDurationSec', 30)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">+30s</button>
                </div>
              </div>

              <div className="w-full h-px bg-white/10"></div>

              {/* SEZIONE DURATA PAUSA */}
              <div>
                <label className="block text-sm font-bold text-neutral-400 mb-4 uppercase tracking-widest text-center">Durata Pausa</label>

                {/* Input manuale (Minuti : Secondi) */}
                <div className="flex items-center justify-center gap-3 mb-6 text-4xl font-bold">
                  {/* Minuti Pausa */}
                  <input
                    type="number"
                    min="0"
                    value={Math.floor(roomSettings.breakDurationSec / 60).toString().padStart(2, '0')}
                    onChange={(e) => handleManualInput('breakDurationSec', e.target.value, roomSettings.breakDurationSec % 60)}
                    className="w-24 bg-black/40 text-center border border-white/10 rounded-2xl py-2 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  />

                  {/* Secondi Pausa */}
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={(roomSettings.breakDurationSec % 60).toString().padStart(2, '0')}
                    onChange={(e) => handleManualInput('breakDurationSec', Math.floor(roomSettings.breakDurationSec / 60), e.target.value)}
                    className="w-24 bg-black/40 text-center border border-white/10 rounded-2xl py-2 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  />
                </div>

                {/* Bottoni Rapidi: Minuti */}
                <div className="flex justify-center gap-2 mb-3">
                  <button onClick={() => updateSettingTime('breakDurationSec', -600)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">-10m</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', -300)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">-5m</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', 300)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">+5m</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', 600)} className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors active:scale-95">+10m</button>
                </div>

                {/* Bottoni Rapidi: Secondi */}
                <div className="flex justify-center gap-2">
                  <button onClick={() => updateSettingTime('breakDurationSec', -30)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">-30s</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', -10)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">-10s</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', 10)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">+10s</button>
                  <button onClick={() => updateSettingTime('breakDurationSec', 30)} className="flex-1 py-2 bg-black/40 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold text-neutral-400 transition-colors active:scale-95">+30s</button>
                </div>
              </div>

              {/* TOGGLE PASSAGGIO AUTOMATICO */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10">
                <label className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Passaggio Automatico</label>
                <button
                  onClick={() => setRoomSettings({ ...roomSettings, autoSwitch: !roomSettings.autoSwitch })}
                  className={`w-14 h-8 rounded-full transition-colors relative ${roomSettings.autoSwitch ? 'bg-emerald-500' : 'bg-white/10'}`}
                >
                  <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-transform ${roomSettings.autoSwitch ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>
            </div>

            <button onClick={applyAndSaveSettings} className="w-full mt-10 py-5 bg-red-600/80 hover:bg-red-500 text-white font-bold rounded-2xl transition-all shadow-xl active:scale-95 text-lg tracking-wide">
              Chiudi e Applica
            </button>
          </div>
        </div>
      )}

      <nav className="bg-black/40 backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex flex-row justify-between items-center gap-2 sm:gap-4 w-full">

          {/* Sinistra: Logo e Nome App */}
          <h1 className="text-base sm:text-2xl font-bold tracking-tight sm:tracking-wider flex items-center gap-1 sm:gap-2 drop-shadow-lg text-white whitespace-nowrap shrink-0">
            🍒 CilieginoFocus
          </h1>

          {/* Destra: Utente e Bottone Esci */}
          <div className="flex items-center gap-2 sm:gap-4 justify-end min-w-0">
            <div className="text-[10px] sm:text-sm bg-white/10 border border-white/20 backdrop-blur-md px-2 py-1 sm:px-4 sm:py-1.5 rounded-full font-medium shadow-inner truncate min-w-0">
              {session.user.email}
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-xs sm:text-sm text-red-400 hover:text-red-300 hover:underline font-semibold transition-colors shrink-0 whitespace-nowrap"
            >
              Esci
            </button>
          </div>

        </div>
      </nav>

      {!currentRoom ? (
        <main className="max-w-4xl mx-auto mt-12 p-4 w-full">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex flex-row items-center gap-4 sm:gap-6 w-full">
                {/* Contenitore Avatar Fisso */}
                <div className="w-20 h-20 sm:w-28 sm:h-28 bg-black/40 rounded-2xl border border-white/10 shadow-inner flex items-center justify-center shrink-0">
                  <PixelAvatar type={profile.avatar_id} size="w-14 h-14 sm:w-20 sm:h-20" />
                </div>

                {/* Contenitore Testo/Input */}
                <div className="flex-1 min-w-0 text-left">
                  {isEditingProfile ? (
                    <div className="space-y-3">
                      <input
                        className="bg-black/60 border border-white/20 p-2 rounded-lg text-white w-full outline-none focus:ring-1 focus:ring-red-500 text-sm"
                        value={profile.nickname}
                        placeholder="Nickname..."
                        onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                      />
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                        {Object.keys(PIXEL_FRUITS).map(id => (
                          <button
                            key={id}
                            onClick={() => setProfile({ ...profile, avatar_id: id })}
                            className={`p-1.5 rounded-xl border transition-all flex justify-center ${profile.avatar_id === id ? 'bg-red-600/20 border-red-500' : 'bg-white/5 border-white/10'}`}
                          >
                            <PixelAvatar type={id} size="w-6 h-6 sm:w-8 h-8" />
                          </button>
                        ))}
                      </div>
                      <button onClick={saveProfile} className="bg-emerald-600 px-3 py-1.5 rounded-lg font-bold text-xs">
                        Salva
                      </button>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-xl md:text-3xl font-bold text-white flex items-center gap-2 md:gap-3">
                        <span className="truncate" title={profile.nickname}>
                          {profile.nickname || 'Studente Anonimo'}
                        </span>
                        <button onClick={() => setIsEditingProfile(true)} className="text-[10px] md:text-xs bg-white/10 px-2 py-1 rounded hover:bg-white/20 shrink-0">
                          Modifica
                        </button>
                      </h2>
                      <p className="text-neutral-400 mt-1 uppercase text-xs tracking-tighter font-bold">Grado: {mascot.name}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-8 text-center bg-black/30 border border-white/5 backdrop-blur-md p-5 rounded-2xl w-full md:w-auto shadow-inner">
                <div>
                  <span className="block text-4xl font-bold text-white">{globalStats.pomodoros}</span>
                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 block">Pomodori</span>
                </div>
                <div className="w-px bg-white/10"></div>
                <div>
                  <span className="block text-4xl font-bold text-white">{(globalStats.totalSeconds / 3600).toFixed(1)}h</span>
                  <span className="text-xs text-neutral-400 font-bold uppercase tracking-widest mt-1 block">Ore</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl mb-8">
            <h2 className="text-2xl font-bold mb-5 text-white drop-shadow-md">Crea una nuova stanza</h2>
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <input
                type="text"
                placeholder="Nome della stanza (es. EsameFisica)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full px-4 py-3 md:px-5 md:py-4 bg-black/40 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-red-500/50 border border-white/10 placeholder-neutral-500 backdrop-blur-sm transition-all shadow-inner"
              />
              <button
                onClick={() => joinRoom(newRoomName)}
                className="w-full md:w-auto bg-red-600/80 hover:bg-red-500 backdrop-blur-md border border-red-500/50 text-white px-6 py-3 md:px-8 md:py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 whitespace-nowrap"
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
            <div className="md:col-span-3 mb-2 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-lg">

              {/* Gruppo Bottoni Sinistra */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <button
                  onClick={leaveRoom}
                  className="text-neutral-300 hover:text-white flex items-center gap-1 sm:gap-2 transition-colors font-medium px-2 py-1 text-sm sm:text-base whitespace-nowrap"
                >
                  ← Torna alla Lobby
                </button>

                {roomCreator === session.user.id && (
                  <div className="hidden sm:block w-px h-6 bg-white/20 mx-2"></div>
                )}

                {roomCreator === session.user.id && (
                  <button
                    onClick={deleteRoom}
                    className="bg-red-900/80 hover:bg-red-800 backdrop-blur-md border border-red-500/30 text-red-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-semibold transition-all text-xs sm:text-sm shadow-md active:scale-95 whitespace-nowrap"
                  >
                    Elimina Stanza
                  </button>
                )}
              </div>

              {/* Contatore Connessi */}
              <div className="flex items-center justify-center sm:justify-start gap-3 bg-black/40 px-4 py-2 rounded-xl border border-emerald-500/30 shadow-inner w-full sm:w-auto">
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-bold text-emerald-400 tracking-wide whitespace-nowrap">
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

                <div className="text-[70px] sm:text-[90px] md:text-[120px] font-mono font-bold leading-none tracking-tighter mb-8 md:mb-12 drop-shadow-2xl">
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
                  {onlineUsers.map((user, idx) => (
                    <li key={idx} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-lg border border-white/5">
                      <PixelAvatar type={user.avatar_id} size="w-6 h-6" />
                      <div className="flex flex-col">
                        <span className="font-bold text-white">{user.nickname || 'Anonimo'}</span>
                        <span className="text-[10px] text-neutral-500">{user.user_email}</span>
                      </div>
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
                  <span className="font-bold text-white text-lg bg-white/10 px-3 py-1 rounded-lg border border-white/10">{Math.floor(roomStats.totalSeconds / 60)}</span>
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
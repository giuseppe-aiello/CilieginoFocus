import React, { useState, useEffect } from 'react';
import { useTimer } from '../hooks/useTimer';
import { useStats } from '../hooks/useStats';
import PixelAvatar from '../components/PixelAvatar';
import SettingsModal from '../components/SettingsModal';
import { getMascotStage } from '../utils/mascot';

export default function Room({
    roomName,
    session,
    profile,
    roomSettings,
    onlineUsers,
    onLeave,
    updateRoomSettingsInDb
}) {
    const [showSettings, setShowSettings] = useState(false);

    const { roomStats, personalStats, fetchStats } = useStats(session, roomName);

    const {
        timeLeft,
        isRunning,
        mode,
        toggleTimer,
        resetTimer,
        switchMode,
        pauseTimer, // funzione per pausa quando stanza vuota
        setPausedRemainingSec,
        setTimeLeft
    } = useTimer(session, roomName, roomSettings, (completedMode, autoStarted) => {
    // ... (resto invariato)
        fetchStats();
        if (!autoStarted) {
            alert(completedMode === 'study' ? "Sessione completata! Inizia la pausa." : "Pausa terminata! Torna a studiare.");
        }
    });

    const applyAndSaveSettings = async (draftSettings) => {
        // Salva le nuove impostazioni nel database senza modificare il timeLeft o il pausedRemainingSec attuali
        await updateRoomSettingsInDb(draftSettings, isRunning ? pausedRemainingSec : timeLeft);
        setShowSettings(false);
    };

    // Gestisce l'uscita tramite il bottone
    const handleExitRoom = async () => {
        // Se c'è solo un utente (o zero) e il timer sta scorrendo, metti in pausa
        if (onlineUsers.length <= 1 && isRunning) {
            await pauseTimer();
        }
        onLeave();
    };

    // Gestisce la chiusura improvvisa della scheda/browser
    useEffect(() => {
        const handleBeforeUnload = () => {
            if (onlineUsers.length <= 1 && isRunning) {
                // Invia una richiesta "fire-and-forget" al database per mettere in pausa
                supabase.from('pomodoro_sessions').update({
                    is_running: false,
                    target_end_time: null,
                    paused_remaining_sec: timeLeft,
                    last_updated_at: new Date()
                }).eq('room_name', roomName).then();
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [onlineUsers.length, isRunning, timeLeft, roomName]);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const progressPercentage = mode === 'study'
        ? ((roomSettings.studyDurationSec - timeLeft) / roomSettings.studyDurationSec) * 100
        : ((roomSettings.breakDurationSec - timeLeft) / roomSettings.breakDurationSec) * 100;

    // Genera lo stato corrente della mascotte passando i secondi della stanza
    const mascot = getMascotStage(roomStats.totalSeconds);

        
    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
            {/* HEADER STANZA */}
            <header className="p-4 sm:p-6 flex justify-between items-center border-b border-white/10 bg-black/40">
                <h2 className="text-xl sm:text-3xl font-bold tracking-wider flex items-center gap-3">
                    <span className="text-red-500">📍</span> {roomName}
                </h2>
                <button
                    onClick={handleExitRoom} // <-- Sostituisci onLeave con handleExitRoom
                    className="px-4 py-2 bg-white/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl font-bold transition-all border border-transparent hover:border-red-500/50"
                >
                    Esci dalla Stanza
                </button>
            </header>

            <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10">

                {/* COLONNA SINISTRA: TIMER */}
                <div className="lg:col-span-2 flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-12 relative overflow-hidden">

                    {/* Barra di progresso in background */}
                    <div
                        className={`absolute bottom-0 left-0 w-full opacity-10 transition-all duration-1000 ${mode === 'study' ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ height: `${progressPercentage}%` }}
                    />

                    {/* Toggle Modalità */}
                    <div className="flex bg-black/40 rounded-full p-1 border border-white/10 mb-10 z-10 relative">
                        <button
                            onClick={() => switchMode('study')}
                            className={`px-8 py-3 rounded-full font-bold transition-all ${mode === 'study' ? 'bg-red-500 shadow-lg scale-105' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Studio
                        </button>
                        <button
                            onClick={() => switchMode('break')}
                            className={`px-8 py-3 rounded-full font-bold transition-all ${mode === 'break' ? 'bg-emerald-500 shadow-lg scale-105' : 'text-neutral-400 hover:text-white'}`}
                        >
                            Pausa
                        </button>
                    </div>

                    {/* Orologio Gigante */}
                    <div className="text-[6rem] sm:text-[9rem] font-black tracking-tighter tabular-nums drop-shadow-2xl z-10 relative leading-none mb-10">
                        {formatTime(timeLeft)}
                    </div>

                    {/* Controlli Timer */}
                    <div className="flex items-center gap-4 z-10 relative">
                        <button
                            onClick={toggleTimer}
                            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center text-3xl sm:text-4xl transition-all shadow-2xl active:scale-95 border-4 ${isRunning
                                ? 'bg-neutral-800 text-white border-neutral-700 hover:bg-neutral-700'
                                : `text-white border-transparent hover:scale-105 ${mode === 'study' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`
                                }`}
                        >
                            {isRunning ? '⏸' : '▶'}
                        </button>

                        <button
                            onClick={resetTimer}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-xl transition-all active:scale-95"
                            title="Resetta Timer"
                        >
                            🔄
                        </button>

                        <button
                            onClick={() => setShowSettings(true)}
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-xl transition-all active:scale-95"
                            title="Impostazioni"
                        >
                            ⚙️
                        </button>
                    </div>
                </div>

                {/* COLONNA DESTRA: SIDEBAR (Utenti e Statistiche) */}
                <div className="flex flex-col gap-6">
                    {/* Ciliegino della Stanza (Mascotte) */}
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

                    {/* Utenti Online */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-sm mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                            Compagni di Studio
                            <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs">
                                {onlineUsers.length}
                            </span>
                        </h3>
                        <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                            {onlineUsers.map((user, idx) => (
                                <div key={idx} className="flex items-center gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
                                    <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-white/5 rounded-full overflow-hidden">
                                        <PixelAvatar type={user.avatar_id} size="w-6" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="font-bold text-sm text-white truncate">{user.nickname}</div>
                                        <div className="text-xs text-neutral-500 truncate">{user.user_email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Statistiche Stanza */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex-1">
                        <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-sm mb-4 border-b border-white/10 pb-2">
                            Rendimento della Stanza
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                                <div className="text-3xl font-black text-red-500 mb-1">{roomStats.pomodoros}</div>
                                <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Pomodori</div>
                            </div>
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 text-center">
                                <div className="text-3xl font-black text-emerald-500 mb-1">{Math.floor(roomStats.totalSeconds / 60)}</div>
                                <div className="text-xs text-neutral-500 uppercase tracking-wider font-bold">Minuti</div>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {showSettings && (
                <SettingsModal
                    settings={roomSettings}
                    onSave={applyAndSaveSettings}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </div>
    );
}
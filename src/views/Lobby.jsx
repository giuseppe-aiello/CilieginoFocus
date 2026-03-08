import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import PixelAvatar from '../components/PixelAvatar';
import { PIXEL_FRUITS } from '../utils/pixelArt';
import { useStats } from '../hooks/useStats';

export default function Lobby({
    session,
    profile,
    setProfile,
    saveProfile,
    rooms,
    onJoinRoom,
    onDeleteRoom,
    onLogout
}) {
    const [newRoomName, setNewRoomName] = useState('');
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const { globalStats } = useStats(session, null);

    const handleJoin = (e) => {
        e.preventDefault();
        if (newRoomName.trim()) {
            onJoinRoom(newRoomName.trim());
            setNewRoomName('');
        }
    };

    const handleSaveProfile = async () => {
        await saveProfile();
        setIsEditingProfile(false);
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
            <Navbar session={session} onLogout={onLogout} />

            <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* COLONNA SINISTRA: PROFILO E STATISTICHE */}
                <div className="md:col-span-1 flex flex-col gap-8">

                    {/* SEZIONE PROFILO */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-red-600/40 to-emerald-600/40 opacity-50"></div>

                        <div className="relative z-10 flex flex-col items-center mt-8">
                            <div className="w-24 h-24 bg-black/50 border-4 border-neutral-900 rounded-full flex items-center justify-center shadow-xl mb-4 overflow-hidden">
                                <PixelAvatar type={profile?.avatar_id || 'pomodoro'} size="w-14" />
                            </div>

                            {!isEditingProfile ? (
                                <>
                                    <h2 className="text-2xl font-black tracking-tight mb-1">{profile?.nickname || 'Nuovo Studente'}</h2>
                                    <p className="text-sm text-neutral-400 mb-6">{session?.user?.email}</p>
                                    <button
                                        onClick={() => setIsEditingProfile(true)}
                                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-all border border-white/5"
                                    >
                                        Modifica Profilo
                                    </button>
                                </>
                            ) : (
                                <div className="w-full flex flex-col gap-4">
                                    <input
                                        type="text"
                                        value={profile?.nickname || ''}
                                        onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Il tuo nickname"
                                    />
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.keys(PIXEL_FRUITS).map((fruit) => (
                                            <button
                                                key={fruit}
                                                onClick={() => setProfile({ ...profile, avatar_id: fruit })}
                                                className={`p-2 rounded-xl border flex justify-center items-center transition-all ${profile?.avatar_id === fruit ? 'bg-white/20 border-white/50 scale-110 shadow-lg' : 'bg-black/40 border-white/10 hover:bg-white/10'}`}
                                            >
                                                <PixelAvatar type={fruit} size="w-6" />
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={handleSaveProfile}
                                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg mt-2"
                                    >
                                        Salva Modifiche
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEZIONE STATISTICHE GLOBALI */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                        <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-sm mb-6 border-b border-white/10 pb-2">I Tuoi Risultati</h3>
                        <div className="flex flex-col gap-4">
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <span className="text-neutral-400 font-bold">Pomodori Totali</span>
                                <span className="text-2xl font-black text-red-500">{globalStats.pomodoros}</span>
                            </div>
                            <div className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-center">
                                <span className="text-neutral-400 font-bold">Minuti di Studio</span>
                                <span className="text-2xl font-black text-emerald-500">{Math.floor(globalStats.totalSeconds / 60)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* COLONNA DESTRA: STANZE */}
                <div className="md:col-span-2 flex flex-col gap-6">
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
                        <h2 className="text-2xl font-bold mb-2">Entra in una Stanza</h2>
                        <p className="text-neutral-400 mb-8">Unisciti ai tuoi compagni o crea un nuovo ambiente di studio inserendo un nome.</p>

                        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-10">
                            <input
                                type="text"
                                value={newRoomName}
                                onChange={(e) => setNewRoomName(e.target.value)}
                                placeholder="es. Analisi Matematica"
                                className="w-full sm:flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-4 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium placeholder-neutral-600 transition-all"
                                required
                            />
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-8 py-4 sm:py-0 bg-white text-black hover:bg-neutral-200 font-black rounded-xl transition-all active:scale-95 shadow-xl flex items-center justify-center"
                            >
                                Entra
                            </button>
                        </form>

                        <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-sm mb-4 border-b border-white/10 pb-2 flex justify-between items-center">
                            Stanze Attive Recenti
                            <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs border border-red-500/20">Live</span>
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {rooms.length === 0 ? (
                                <div className="col-span-full text-center py-10 text-neutral-500 font-medium bg-black/20 rounded-2xl border border-dashed border-white/10">
                                    Nessuna stanza attiva al momento. Creane una tu!
                                </div>
                            ) : (
                                rooms.map((room) => (
                                    <div key={room.room_name} className="group bg-black/40 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl p-4 transition-all flex flex-col justify-between h-32 relative overflow-hidden">
                                        <div className="z-10 flex justify-between items-start">
                                            <h4 className="font-bold text-lg truncate pr-4">{room.room_name}</h4>
                                            {room.created_by === session?.user?.id && (
                                                <button
                                                    onClick={() => onDeleteRoom(room.room_name)}
                                                    className="text-neutral-500 hover:text-red-500 transition-colors"
                                                    title="Elimina stanza"
                                                >
                                                    🗑️
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => onJoinRoom(room.room_name)}
                                            className="z-10 w-full py-2 bg-white/5 group-hover:bg-red-600 text-white rounded-xl font-bold transition-all text-sm mt-auto"
                                        >
                                            Partecipa
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </main>
        </div>
    );
}
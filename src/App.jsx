import React, { useState } from 'react';
import Auth from './Auth';
import Lobby from './views/Lobby';
import Room from './views/Room';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useRoom } from './hooks/useRoom';

export default function App() {
    const { session, loading: authLoading, signOut } = useAuth();
    const { profile, setProfile, saveProfile, loading: profileLoading } = useProfile(session);

    // Nuovo stato per la transizione
    const [appLoading, setAppLoading] = useState(false);

    const {
        rooms,
        currentRoom,
        onlineUsers,
        roomSettings,
        joinRoom,
        leaveRoom,
        deleteRoom,
        updateRoomSettingsInDb
    } = useRoom(session, profile);

    // Funzioni wrapper per gestire l'inizio e la fine del caricamento
    const handleJoinRoom = async (name) => {
        setAppLoading(true);
        await joinRoom(name);
    };

    const handleLeaveRoom = () => {
        setAppLoading(true);
        leaveRoom();
        setTimeout(() => setAppLoading(false), 600); // Spegne il loading una volta tornati in Lobby
    };

    // Variabile booleana: se uno qualsiasi di questi è vero, mostriamo la maschera
    const showLoading = authLoading || (session && profileLoading) || appLoading;

    return (
        <>
            {/* OVERLAY DI CARICAMENTO: Sta sopra a tutto senza bloccare il rendering */}
            {showLoading && (
                <div className="fixed inset-0 z-[100] bg-[#09090b] flex items-center justify-center text-white transition-opacity duration-300">
                    <div className="relative flex flex-col items-center gap-6">
                        <div className="absolute inset-0 rounded-full bg-red-600/20 animate-ping scale-150"></div>
                        <div className="relative bg-black/50 border border-white/10 p-5 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                            <span className="text-4xl">🍒</span>
                        </div>
                        <p className="text-red-200/60 font-bold tracking-[0.2em] uppercase text-xs animate-pulse">
                            Sincronizzazione...
                        </p>
                    </div>
                </div>
            )}

            {/* ROUTING PRINCIPALE */}
            {!session ? (
                <Auth />
            ) : !currentRoom ? (
                <Lobby
                    session={session}
                    profile={profile}
                    setProfile={setProfile}
                    saveProfile={saveProfile}
                    rooms={rooms}
                    onJoinRoom={handleJoinRoom}
                    onDeleteRoom={deleteRoom}
                    onLogout={signOut}
                />
            ) : (
                <Room
                    roomName={currentRoom}
                    session={session}
                    profile={profile}
                    roomSettings={roomSettings}
                    onlineUsers={onlineUsers}
                    onLeave={handleLeaveRoom}
                    updateRoomSettingsInDb={updateRoomSettingsInDb}
                    setIsLoading={setAppLoading} // Passaggio fondamentale del setter
                />
            )}
        </>
    );
}
import React from 'react';
import Auth from './Auth';
import Lobby from './views/Lobby';
import Room from './views/Room';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useRoom } from './hooks/useRoom';

export default function App() {
    const { session, loading: authLoading, signOut } = useAuth();
    const { profile, setProfile, saveProfile, loading: profileLoading } = useProfile(session);
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

    if (authLoading || (session && profileLoading)) {
        return (
            <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <span className="text-4xl">🍒</span>
                    <p className="text-neutral-400 font-bold tracking-widest uppercase text-sm">Caricamento...</p>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Auth />;
    }

    if (!currentRoom) {
        return (
            <Lobby
                session={session}
                profile={profile}
                setProfile={setProfile}
                saveProfile={saveProfile}
                rooms={rooms}
                onJoinRoom={joinRoom}
                onDeleteRoom={deleteRoom}
                onLogout={signOut}
            />
        );
    }

    return (
        <Room
            roomName={currentRoom}
            session={session}
            profile={profile}
            roomSettings={roomSettings}
            onlineUsers={onlineUsers}
            onLeave={leaveRoom}
            updateRoomSettingsInDb={updateRoomSettingsInDb}
        />
    );
}
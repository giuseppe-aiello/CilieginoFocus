import React, { useState, useEffect } from 'react';
import Auth from './Auth';
import Lobby from './views/Lobby';
import Room from './views/Room';
import { useAuth } from './hooks/useAuth';
import { useProfile } from './hooks/useProfile';
import { useRoom } from './hooks/useRoom';
import { refreshSpotifyToken } from './utils/spotify'; // Importa la nuova funzione

export default function App() {
    const { session, loading: authLoading, signOut } = useAuth();
    const { profile, setProfile, saveProfile, loading: profileLoading } = useProfile(session);
    const [appLoading, setAppLoading] = useState(false);
    const [spotifyConnected, setSpotifyConnected] = useState(!!localStorage.getItem('spotify_access_token'));


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

    // Primo useEffect: Gestisce il rinnovo automatico a prova di background
    useEffect(() => {
        const handleVisibilityAndRefresh = async () => {
            const refreshToken = localStorage.getItem('spotify_refresh_token');
            const expiresAt = localStorage.getItem('spotify_token_expires_at');

            if (!refreshToken || !expiresAt) return;

            // Imposta un margine di sicurezza di 5 minuti (300.000 ms)
            const buffer = 300000;
            if (Date.now() > (parseInt(expiresAt) - buffer)) {
                await refreshSpotifyToken();
            }
        };

        // Ascolta quando l'utente torna fisicamente sulla scheda del browser
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleVisibilityAndRefresh();
            }
        });

        // Un timer breve (1 minuto) che controlla il timestamp assoluto.
        // Anche se il browser lo rallenta in background, calcolerà l'ora esatta al suo risveglio.
        const interval = setInterval(handleVisibilityAndRefresh, 60000);

        handleVisibilityAndRefresh();

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityAndRefresh);
            clearInterval(interval);
        };
    }, []);


    // Secondo useEffect: Gestisce il login iniziale e salva il timestamp di partenza
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const codeVerifier = localStorage.getItem('spotify_code_verifier');

        if (!code || !codeVerifier) {
            setAppLoading(false);
            return;
        }

        const fetchSpotifyToken = async () => {
            setAppLoading(true);
            const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const redirectUri = isLocal
                ? 'http://127.0.0.1:5173/'
                : 'https://cilieginofocus.netlify.app/';

            try {
                const response = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_id: clientId,
                        grant_type: 'authorization_code',
                        code: code,
                        redirect_uri: redirectUri,
                        code_verifier: codeVerifier,
                    }),
                });

                const data = await response.json();
                if (data.access_token) {
                    localStorage.setItem('spotify_access_token', data.access_token);
                    localStorage.setItem('spotify_refresh_token', data.refresh_token);

                    // Calcolo e salvataggio del timestamp assoluto al primo login
                    const expireTime = Date.now() + (data.expires_in * 1000);
                    localStorage.setItem('spotify_token_expires_at', expireTime.toString());

                    localStorage.removeItem('spotify_code_verifier');
                }
            } catch (error) {
                console.error("Errore Spotify:", error);
            } finally {
                // src/App.jsx (dentro fetchSpotifyToken, blocco finally)
                window.history.replaceState({}, document.title, '/');
                setAppLoading(false);
            }
        };

        fetchSpotifyToken();
    }, []);

    const handleJoinRoom = async (name) => {
        setAppLoading(true);
        await joinRoom(name);
    };

    const handleLeaveRoom = () => {
        setAppLoading(true);
        leaveRoom();
        setTimeout(() => setAppLoading(false), 600);
    };

    const showLoading = authLoading || (session && profileLoading) || appLoading;

    return (
        <>
            {showLoading && (
                <div className="fixed inset-0 z-[100] bg-[#09090b] flex items-center justify-center text-white transition-opacity duration-300">
                    <div className="flex flex-col items-center gap-6">

                        {/* Contenitore relativo con proporzioni quadrate esatte (w-24 h-24) */}
                        <div className="relative w-24 h-24 flex items-center justify-center">

                            {/* Pulsazione che eredita la forma circolare perfetta (rounded-full) */}
                            <div className="absolute inset-0 rounded-full bg-red-600/20 animate-ping"></div>

                            {/* Sfondo centrale trasformato in un cerchio perfetto */}
                            <div className="relative w-full h-full bg-black/50 border border-white/10 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                                <span className="text-4xl">🍒</span>
                            </div>

                        </div>

                        <p className="text-red-200/60 font-bold tracking-[0.2em] uppercase text-xs animate-pulse">
                            Sincronizzazione...
                        </p>
                    </div>
                </div>
            )}

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
                    setIsLoading={setAppLoading}
                />
            )}
        </>
    );
}
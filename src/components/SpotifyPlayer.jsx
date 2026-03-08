import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

export default function SpotifyPlayer({ token, roomName, isHost }) {
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);

    // Stato locale sincronizzato con il database
    const [trackUri, setTrackUri] = useState('spotify:track:3Zwu2K0Qa5sT6teCCHPShP'); // Traccia Lofi di default
    const [isPlaying, setIsPlaying] = useState(false);

    const [currentTrack, setCurrentTrack] = useState({
        name: "Nessuna traccia",
        artist: "In attesa...",
        albumArt: ""
    });

    const isReady = useRef(false);

    // 1. INIZIALIZZAZIONE DELLA WEB PLAYBACK SDK
    useEffect(() => {
        if (!token) return;

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const playerInstance = new window.Spotify.Player({
                name: 'CilieginoFocus Room',
                getOAuthToken: cb => { cb(token); },
                volume: 0.5
            });

            setPlayer(playerInstance);

            // Listener per il cambiamento dello stato della riproduzione
            playerInstance.addListener('player_state_changed', state => {
                if (!state) return;

                const track = state.track_window.current_track;
                setCurrentTrack({
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    albumArt: track.album.images[0].url
                });

                setIsPlaying(!state.paused);
            });

            playerInstance.addListener('ready', ({ device_id }) => {
                setDeviceId(device_id);
                isReady.current = true;
            });

            playerInstance.connect();
        };

        return () => {
            if (player) player.disconnect();
        };
    }, [token]);

    // 2. CHIAMATE REST API A SPOTIFY
    const syncSpotifyPlayback = async (uri, playStatus, positionMs = 0) => {
        if (!deviceId || !token) return;

        const endpoint = playStatus
            ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`
            : `https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`;

        const body = playStatus ? JSON.stringify({ uris: [uri], position_ms: positionMs }) : null;

        await fetch(endpoint, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: body
        });
    };

    // 3. ASCOLTO E SINCRONIZZAZIONE CON SUPABASE
    useEffect(() => {
        if (!roomName || !isReady.current) return;

        // Recupero stato iniziale
        const fetchInitialState = async () => {
            const { data } = await supabase
                .from('pomodoro_sessions')
                .select('spotify_track_uri, spotify_is_playing, spotify_position_ms, spotify_updated_at')
                .eq('room_name', roomName)
                .single();

            if (data) {
                setTrackUri(data.spotify_track_uri || trackUri);
                setIsPlaying(data.spotify_is_playing || false);

                // Calcola la compensazione del ritardo in base a quando è stato premuto play
                let position = data.spotify_position_ms || 0;
                if (data.spotify_is_playing && data.spotify_updated_at) {
                    const timeElapsed = Date.now() - new Date(data.spotify_updated_at).getTime();
                    position += timeElapsed;
                }

                syncSpotifyPlayback(data.spotify_track_uri || trackUri, data.spotify_is_playing, position);
            }
        };

        fetchInitialState();

        // Sottoscrizione ai cambiamenti in tempo reale
        const subscription = supabase.channel(`spotify-${roomName}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pomodoro_sessions', filter: `room_name=eq.${roomName}` }, (payload) => {
                const newData = payload.new;
                setTrackUri(newData.spotify_track_uri);
                setIsPlaying(newData.spotify_is_playing);

                let position = newData.spotify_position_ms || 0;
                if (newData.spotify_is_playing && newData.spotify_updated_at) {
                    const timeElapsed = Date.now() - new Date(newData.spotify_updated_at).getTime();
                    position += timeElapsed;
                }

                syncSpotifyPlayback(newData.spotify_track_uri, newData.spotify_is_playing, position);
            })
            .subscribe();

        return () => supabase.removeChannel(subscription);
    }, [roomName, deviceId]);

    // 4. AZIONI DELL'HOST (Scrivono su Supabase, che a sua volta aggiorna tutti tramite la sottoscrizione)
    const togglePlayPause = async () => {
        if (!isHost) return;

        const newState = !isPlaying;

        // Ottieni la posizione attuale dal player locale per sincronizzare gli altri
        const state = await player.getCurrentState();
        const currentPosition = state ? state.position : 0;

        await supabase.from('pomodoro_sessions').update({
            spotify_is_playing: newState,
            spotify_position_ms: currentPosition,
            spotify_track_uri: trackUri,
            spotify_updated_at: new Date().toISOString()
        }).eq('room_name', roomName);
    };

    if (!token) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-neutral-500 text-sm font-bold">Collega Spotify dalla Lobby per ascoltare musica.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#1db954]/10 border border-[#1db954]/30 rounded-3xl p-6 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(29,185,84,0.1)]">
            <h3 className="text-[#1db954] font-bold uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#1db954] animate-pulse"></span>
                Spotify Live
            </h3>

            {!deviceId ? (
                <p className="text-neutral-400 text-sm font-medium animate-pulse">Inizializzazione...</p>
            ) : (
                <div className="flex flex-col items-center w-full">
                    {/* Info Canzone */}
                    <div className="flex items-center gap-4 mb-6 w-full bg-black/20 p-3 rounded-2xl border border-white/5">
                        {currentTrack.albumArt && (
                            <img
                                src={currentTrack.albumArt}
                                alt="Album Art"
                                className="w-12 h-12 rounded-lg shadow-lg shadow-black/50"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-white text-sm font-bold truncate leading-tight">
                                {currentTrack.name}
                            </p>
                            <p className="text-neutral-400 text-xs truncate">
                                {currentTrack.artist}
                            </p>
                        </div>
                    </div>

                    {/* Controlli */}
                    <button
                        onClick={togglePlayPause}
                        disabled={!isHost}
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all shadow-lg ${!isHost
                                ? 'bg-black/40 text-neutral-500 cursor-not-allowed border border-white/5'
                                : 'bg-[#1db954] hover:bg-[#1ed760] text-black hover:scale-105 active:scale-95'
                            }`}
                    >
                        {isPlaying ? '⏸' : '▶'}
                    </button>

                    {!isHost && (
                        <p className="text-[9px] text-neutral-500 mt-3 uppercase tracking-tighter font-bold">
                            Sincronizzato con l'Host
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
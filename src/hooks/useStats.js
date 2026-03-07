import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useStats = (session, currentRoom) => {
    const [personalStats, setPersonalStats] = useState({ pomodoros: 0, totalSeconds: 0 });
    const [roomStats, setRoomStats] = useState({ pomodoros: 0, totalSeconds: 0 });
    const [globalStats, setGlobalStats] = useState({ pomodoros: 0, totalSeconds: 0 });

    // Funzione di utilità interna per calcolare i totali
    const calcStats = (data) => ({
        pomodoros: data ? data.length : 0,
        totalSeconds: data ? data.reduce((acc, curr) => acc + curr.duration_seconds, 0) : 0
    });

    // Recupera le statistiche totali dell'utente (usato nella Lobby)
    const fetchGlobalStats = useCallback(async () => {
        if (!session?.user) return;

        const { data } = await supabase
            .from('study_history')
            .select('duration_seconds')
            .eq('user_id', session.user.id);

        setGlobalStats(calcStats(data));
    }, [session]);

    // Recupera le statistiche contestuali alla stanza corrente
    const fetchStats = useCallback(async () => {
        if (!session?.user || !currentRoom) return;

        // Storico personale dell'utente
        const { data: personalData } = await supabase
            .from('study_history')
            .select('duration_seconds')
            .eq('user_id', session.user.id);

        // Storico collettivo della stanza
        const { data: roomData } = await supabase
            .from('study_history')
            .select('duration_seconds')
            .eq('room_name', currentRoom);

        setPersonalStats(calcStats(personalData));
        setRoomStats(calcStats(roomData));
    }, [session, currentRoom]);

    // Ascoltatore per la Lobby: si attiva quando c'è sessione ma non c'è stanza
    useEffect(() => {
        if (session && !currentRoom) {
            fetchGlobalStats();
        }
    }, [session, currentRoom, fetchGlobalStats]);

    // Ascoltatore per la Stanza: si attiva quando l'utente entra in una stanza
    useEffect(() => {
        if (session && currentRoom) {
            fetchStats();
        }
    }, [session, currentRoom, fetchStats]);

    return {
        personalStats,
        roomStats,
        globalStats,
        fetchStats,
        fetchGlobalStats
    };
};
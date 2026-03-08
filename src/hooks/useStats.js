import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useStats = (session, currentRoom) => {
    const [personalStats, setPersonalStats] = useState({ pomodoros: 0, totalSeconds: 0 });
    const [roomStats, setRoomStats] = useState({ pomodoros: 0, totalSeconds: 0 });
    const [globalStats, setGlobalStats] = useState({ pomodoros: 0, totalSeconds: 0 });


    const [dailyStats, setDailyStats] = useState({});

    // Funzione di utilità interna per calcolare i totali
    const calcStats = (data) => ({
        pomodoros: data ? data.length : 0,
        totalSeconds: data ? data.reduce((acc, curr) => acc + curr.duration_seconds, 0) : 0
    });

    const fetchGlobalStats = useCallback(async () => {
        if (!session?.user) return;

        const { data, error } = await supabase
            .from('study_history')
            .select('duration_seconds, completed_at')
            .eq('user_id', session.user.id);

        if (error) {
            console.error("Errore recupero stats:", error);
            return;
        }

        if (data && data.length > 0) {
            let totalSecs = 0;
            const aggregatedDaily = {};

            data.forEach(record => {
                totalSecs += record.duration_seconds;

                const d = new Date(record.completed_at);
                if (!isNaN(d.getTime())) {
                    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

                    // Crea la struttura a oggetto per il calendario
                    if (!aggregatedDaily[dateKey]) {
                        aggregatedDaily[dateKey] = { seconds: 0, count: 0 };
                    }
                    aggregatedDaily[dateKey].seconds += record.duration_seconds;
                    aggregatedDaily[dateKey].count += 1;
                }
            });

            setGlobalStats({
                pomodoros: data.length,
                totalSeconds: totalSecs
            });
            setDailyStats(aggregatedDaily);
        } else {
            setGlobalStats({ pomodoros: 0, totalSeconds: 0 });
            setDailyStats({});
        }
    }, [session?.user?.id]);

    // Recupera le statistiche contestuali alla stanza corrente
    const fetchStats = useCallback(async () => {
        if (!session?.user || !currentRoom) return;

        // Storico personale dell'utente
        const { data: personalData } = await supabase
            .from('study_history')
            .select('duration_seconds')
            .eq('user_id', session.user.id);
            
        setPersonalStats(calcStats(personalData));

        // Storico collettivo della stanza
        const { data: roomData } = await supabase
            .from('study_history')
            .select('duration_seconds','cycle_id')
            .eq('room_name', currentRoom);
        if (roomData) {
            // Usiamo una Mappa: se 5 utenti hanno inserito lo stesso cycle_id, 
            // la mappa terrà un solo record per quell'ID.
            const uniqueCycles = new Map();

            roomData.forEach(record => {
                // Se il record non ha cycle_id (vecchi dati), genera una chiave casuale per contarlo comunque
                const key = record.cycle_id || Math.random().toString();
                uniqueCycles.set(key, record.duration_seconds);
            });

            // Somma la durata solo dei cicli unici
            let totalUniqueSeconds = 0;
            uniqueCycles.forEach(duration => {
                totalUniqueSeconds += duration;
            });

            setRoomStats({
                pomodoros: uniqueCycles.size, // Il numero di record unici nella Mappa
                totalSeconds: totalUniqueSeconds
            });
        } else {
            setRoomStats({ pomodoros: 0, totalSeconds: 0 });
        }
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
        dailyStats,
        fetchStats,
        fetchGlobalStats
    };
};
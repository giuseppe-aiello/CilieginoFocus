import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const alarmSound = new Audio('/rooster.wav');

export const useTimer = (session, currentRoom, roomSettings, onTimerComplete) => {
    const [timeLeft, setTimeLeft] = useState(1500);
    const [isRunning, setIsRunning] = useState(false);
    const [targetEndTime, setTargetEndTime] = useState(null);
    const [pausedRemainingSec, setPausedRemainingSec] = useState(1500);
    const [mode, setMode] = useState('study');

    const workerRef = useRef(null);
    const logicRef = useRef(null);

    // Mantiene un riferimento aggiornato all'ambiente attuale per quando il Worker scatta a zero
    useEffect(() => {
        logicRef.current = { handlePomodoroComplete };
    });

    // 1. INIZIALIZZAZIONE DEL WEB WORKER
    useEffect(() => {
        // Sintassi specifica di Vite per caricare un Worker
        workerRef.current = new Worker(new URL('../workers/timerWorker.js', import.meta.url), { type: 'module' });

        // Ascolta le risposte dal Worker
        workerRef.current.onmessage = (e) => {
            if (e.data.type === 'tick') {
                setTimeLeft(e.data.remaining); // Aggiorna i secondi a schermo
            } else if (e.data.type === 'finished') {
                // Esegue la logica di fine ciclo
                logicRef.current.handlePomodoroComplete();
            }
        };

        return () => {
            workerRef.current.terminate(); // Distrugge il processo in background quando chiudi la stanza
        };
    }, []);

    // 2. SINCRONIZZAZIONE INIZIALE E REALTIME DEL TIMER (Dal Database)
    useEffect(() => {
        if (!currentRoom) return;

        const initializeTimer = async () => {
            const { data, error } = await supabase
                .from('pomodoro_sessions')
                .select('mode, is_running, target_end_time, paused_remaining_sec')
                .eq('room_name', currentRoom)
                .single();

            if (data && !error) {
                setMode(data.mode || 'study');
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
        };

        initializeTimer();

        const timerSubscription = supabase.channel(`timer-${currentRoom}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pomodoro_sessions', filter: `room_name=eq.${currentRoom}` }, (payload) => {
                const newData = payload.new;
                setMode(newData.mode || 'study');
                setIsRunning(newData.is_running);
                setTargetEndTime(newData.target_end_time);
                setPausedRemainingSec(newData.paused_remaining_sec);

                // Allinea visivamente tutti i client sul tempo esatto di partenza/pausa
                setTimeLeft(newData.paused_remaining_sec);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(timerSubscription);
        };
    }, [currentRoom]);


    // 3. INVIO COMANDI AL WORKER QUANDO LO STATO CAMBIA
    useEffect(() => {
        if (isRunning && targetEndTime) {
            // Ordina al worker di iniziare a contare in background
            workerRef.current.postMessage({ command: 'start', targetEndTime });
        } else {
            // Ordina al worker di fermarsi
            workerRef.current.postMessage({ command: 'stop' });
            setTimeLeft(pausedRemainingSec);
        }
    }, [isRunning, targetEndTime, pausedRemainingSec]);


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
        let newTarget = null;
        let newPausedSec = pausedRemainingSec;

        if (newIsRunning) {
            newTarget = new Date(Date.now() + pausedRemainingSec * 1000).toISOString();
        } else {
            const remaining = targetEndTime
                ? Math.max(0, Math.ceil((new Date(targetEndTime).getTime() - Date.now()) / 1000))
                : pausedRemainingSec;
            newPausedSec = remaining;
        }

        // Invia esclusivamente il comando al database.
        // Nessun aggiornamento di stato locale (non inserire setIsRunning, setTargetEndTime o setTimeLeft qui).
        await supabase.from('pomodoro_sessions').update({
            is_running: newIsRunning,
            target_end_time: newTarget,
            paused_remaining_sec: newPausedSec,
            last_updated_at: new Date()
        }).eq('room_name', currentRoom);
    };

    const resetTimer = async () => {
        setIsRunning(false);

        const { data: currentData, error: readError } = await supabase
            .from('pomodoro_sessions')
            .select('study_duration_sec, break_duration_sec')
            .eq('room_name', currentRoom)
            .single();

        if (readError) return;

        const NEW_STUDY = currentData.study_duration_sec;
        const NEW_BREAK = currentData.break_duration_sec;
        const resetSecs = mode === 'study' ? NEW_STUDY : NEW_BREAK;

        setTimeLeft(resetSecs);
        setPausedRemainingSec(resetSecs);
        setTargetEndTime(null);

        await supabase.from('pomodoro_sessions').update({
            is_running: false,
            target_end_time: null,
            paused_remaining_sec: resetSecs,
            last_updated_at: new Date()
        }).eq('room_name', currentRoom);
    };

    const handlePomodoroComplete = async () => {
        setIsRunning(false);

        try {
            alarmSound.currentTime = 0;
            alarmSound.play();
        } catch (error) {
            console.error("Il browser ha bloccato l'audio in autoplay:", error);
        }

        if ('Notification' in window && Notification.permission === 'granted') {
            const isStudy = mode === 'study';
            const notifTitle = isStudy ? "Sessione Terminata! BRAVA CICCIOBARULLA 🍅" : "Pausa Finita! Adesso è ora di studiare cicciobarulla... 📚";
            const notifBody = isStudy
                ? "Ottimo lavoro! Goditi i tuoi minuti di pausa."
                : "Pausa terminata. È ora di tornare a concentrarsi.";

            new Notification(notifTitle, {
                body: notifBody,
                icon: '/favicon.ico'
            });
        }

        if (mode === 'study') {
            // Implementazione dell'Identificativo Condiviso per deduplicare i dati nel DB e annullare il lag visivo
            const syncTime = targetEndTime || new Date(Math.floor(Date.now() / 10000) * 10000).toISOString();
            const cycleId = `${currentRoom}_${syncTime}`;

            await supabase.from('study_history').insert([{
                user_id: session.user.id,
                room_name: currentRoom,
                duration_seconds: roomSettings.studyDurationSec,
                cycle_id: cycleId,
                completed_at: syncTime // Sovrascrive l'orologio del server con il tempo ideale calcolato dal Worker
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

        onTimerComplete(mode, shouldAutoStart);
    };

    // Nuova funzione per forzare la pausa
    const pauseTimer = async () => {
        if (!isRunning) return;

        const remaining = targetEndTime
            ? Math.max(0, Math.ceil((new Date(targetEndTime).getTime() - Date.now()) / 1000))
            : pausedRemainingSec;

        setIsRunning(false);
        setPausedRemainingSec(remaining);
        setTimeLeft(remaining);
        setTargetEndTime(null);

        // Ferma il Web Worker
        if (workerRef.current) {
            workerRef.current.postMessage({ command: 'stop' });
        }

        await supabase.from('pomodoro_sessions').update({
            is_running: false,
            target_end_time: null,
            paused_remaining_sec: remaining,
            last_updated_at: new Date()
        }).eq('room_name', currentRoom);
    };

    return {
        timeLeft,
        isRunning,
        mode,
        toggleTimer,
        resetTimer,
        switchMode,
        pauseTimer, // <-- Aggiungi l'esportazione qui
        setIsRunning,
        setMode,
        setTargetEndTime,
        setPausedRemainingSec,
        setTimeLeft
    };
};
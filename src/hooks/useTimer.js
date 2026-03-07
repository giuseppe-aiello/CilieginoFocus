import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const alarmSound = new Audio('/rooster.wav');

export const useTimer = (session, currentRoom, roomSettings, fetchStats) => {

    const [timeLeft, setTimeLeft] = useState(1500); // Variabile puramente visiva
    const [isRunning, setIsRunning] = useState(false);
    const [targetEndTime, setTargetEndTime] = useState(null);
    const [pausedRemainingSec, setPausedRemainingSec] = useState(1500);
    const [mode, setMode] = useState('study'); // 'study' o 'break'


    const timerRef = useRef(null);



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


    //PAUSA / AVVIA
    const toggleTimer = async () => {
        const newIsRunning = !isRunning;
        setIsRunning(newIsRunning);

        let newTarget = null;
        let newPausedSec = pausedRemainingSec;

        if (newIsRunning) { //se è in esecuzione abbiamo bisogno target time e abbiamo appena switchato a in esecuzione
            newTarget = new Date(Date.now() + pausedRemainingSec * 1000).toISOString();
            setTargetEndTime(newTarget);
        } else { //se è in pausa non
            const remaining = targetEndTime
                ? Math.max(0, Math.ceil((new Date(targetEndTime).getTime() - Date.now()) / 1000))
                : pausedRemainingSec;

            newPausedSec = remaining;
            setPausedRemainingSec(remaining);
            setTimeLeft(remaining); //tempo che si modifica ogni secondop
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
        clearInterval(timerRef.current); //interrompe ciclo continuo (non comprende re render interfaccia ->)
        setIsRunning(false); //aggiornamento interfaccia (rerender interfaccia)

        const { data: currentData, error: readError } = await supabase
            .from('pomodoro_sessions')
            .select('study_duration_sec, break_duration_sec')
            .eq('room_name', currentRoom)
            .single();

        if (readError) return;

        const NEW_STUDY = currentData.study_duration_sec
        const NEW_BREAK = currentData.break_duration_sec

        // Sceglie il valore in base alla modalità attuale
        const resetSecs = mode === 'study' ? NEW_STUDY : NEW_BREAK;

        // Aggiorna lo stato locale
        setTimeLeft(resetSecs);
        setPausedRemainingSec(resetSecs);
        setTargetEndTime(null);

        // Aggiorna il database per sincronizzare tutti gli utenti della stanza
        await supabase.from('pomodoro_sessions').update({
            is_running: false,
            target_end_time: null,
            paused_remaining_sec: resetSecs,
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
            newTarget = new Date(Date.now() + nextDurationSec * 1000).toISOString(); //IN MILLISECONDI perchè gestisce in millisecondi
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
    };


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



    return {
        timeLeft,
        isRunning,
        mode,
        toggleTimer,
        resetTimer,
        switchMode,
        setIsRunning,
        setMode,
        setTargetEndTime,
        setPausedRemainingSec,
        setTimeLeft
    }
}
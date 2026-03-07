import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useRoom = (session, profile) => {
    const [rooms, setRooms] = useState([]);
    const [currentRoom, setCurrentRoom] = useState(null);
    const [roomCreator, setRoomCreator] = useState(null);
    const [onlineUsers, setOnlineUsers] = useState([]);

    // Stato per le impostazioni condivise della stanza
    const [roomSettings, setRoomSettings] = useState({
        studyDurationSec: 1500,
        breakDurationSec: 300,
        autoSwitch: false
    });

    // 1. GESTIONE LOBBY E STANZE ATTIVE
    const fetchRooms = async () => {
        const { data } = await supabase
            .from('pomodoro_sessions')
            .select('room_name, created_by')
            .order('last_updated_at', { ascending: false });

        if (data) setRooms(data);
    };

    useEffect(() => {
        if (session && !currentRoom) {
            fetchRooms();

            const lobbySubscription = supabase.channel('public:pomodoro_sessions')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'pomodoro_sessions' }, () => {
                    fetchRooms();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(lobbySubscription);
            };
        }
    }, [session, currentRoom]);

    // 2. AZIONI SULLA STANZA
    const joinRoom = async (roomName) => {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.error("Errore richiesta notifiche:", error);
            }
        }

        if (!roomName.trim()) return;
        const cleanName = roomName.trim();

        const { error } = await supabase
            .from('pomodoro_sessions')
            .select('*')
            .eq('room_name', cleanName)
            .single();

        if (error && error.code === 'PGRST116') {
            const { error: insertError } = await supabase.from('pomodoro_sessions').insert([{
                room_name: cleanName,
                created_by: session.user.id,
                mode: 'study',
                study_duration_sec: 1500,
                break_duration_sec: 300,
                paused_remaining_sec: 1500,
                target_end_time: null,
                auto_switch: false
            }]);

            if (insertError) {
                console.error("ERRORE DATABASE DURANTE LA CREAZIONE:", insertError);
                alert(`Errore database: ${insertError.message}`);
                return;
            }
        }

        setCurrentRoom(cleanName);
    };

    const leaveRoom = () => {
        setCurrentRoom(null);
        setOnlineUsers([]);
        setRoomCreator(null);
    };

    const deleteRoom = async () => {
        const input = window.prompt(`Per eliminare definitivamente la stanza, digita il suo nome esatto: "${currentRoom}"`);

        if (input !== currentRoom) {
            if (input !== null) alert("Il nome inserito non corrisponde. Eliminazione annullata.");
            return;
        }

        await supabase
            .from('pomodoro_sessions')
            .delete()
            .eq('room_name', currentRoom);

        leaveRoom();
    };

    // 3. SINCRONIZZAZIONE REALTIME DELLA STANZA (PRESENCE E SETTINGS)
    useEffect(() => {
        if (!currentRoom || !session || !profile) return; //devono avere valori validi e quindi esisterew

        const initializeRoom = async () => {
            const { data } = await supabase.from('pomodoro_sessions').select('*').eq('room_name', currentRoom).single();
            if (data) {
                setRoomCreator(data.created_by);
                setRoomSettings({
                    studyDurationSec: data.study_duration_sec || 1500,
                    breakDurationSec: data.break_duration_sec || 300,
                    autoSwitch: data.auto_switch || false
                });
            }
        };

        initializeRoom();

        const roomSubscription = supabase.channel(`room-${currentRoom}`, {
            config: {
                presence: { key: session.user.email },
            },
        });

        roomSubscription
            .on('presence', { event: 'sync' }, () => {
                const presenceState = roomSubscription.presenceState();
                const users = Object.keys(presenceState).map(key => presenceState[key][0]);
                setOnlineUsers(users);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pomodoro_sessions', filter: `room_name=eq.${currentRoom}` }, (payload) => {
                setRoomSettings({
                    studyDurationSec: payload.new.study_duration_sec || 1500,
                    breakDurationSec: payload.new.break_duration_sec || 300,
                    autoSwitch: payload.new.auto_switch || false
                });
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await roomSubscription.track({
                        user_email: session.user.email,
                        nickname: profile.nickname || 'Studente',
                        avatar_id: profile.avatar_id || 'pomodoro'
                    });
                }
            });

        return () => {
            roomSubscription.untrack();
            supabase.removeChannel(roomSubscription);
        };
    }, [currentRoom, session, profile]);

    // 4. AGGIORNAMENTO IMPOSTAZIONI NEL DATABASE
    const updateRoomSettingsInDb = async (newSettings, newPausedSec) => {
        await supabase.from('pomodoro_sessions').update({
            study_duration_sec: newSettings.studyDurationSec,
            break_duration_sec: newSettings.breakDurationSec,
            auto_switch: newSettings.autoSwitch,
            paused_remaining_sec: newPausedSec,
            last_updated_at: new Date()
        }).eq('room_name', currentRoom);
    };

    return {
        rooms,
        currentRoom,
        roomCreator,
        onlineUsers,
        roomSettings,
        setRoomSettings,
        joinRoom,
        leaveRoom,
        deleteRoom,
        updateRoomSettingsInDb
    };
};
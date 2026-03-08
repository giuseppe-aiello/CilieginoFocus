import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export const useProfile = (session) => {
    const [profile, setProfile] = useState({ nickname: '', avatar_id: 'pomodoro' });
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [loading, setLoading] = useState(true);

    // Recupera i dati dal database 'profiles'
    const fetchProfile = async () => {
        if (!session?.user) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (data) {
                setProfile({
                    nickname: data.nickname || '',
                    avatar_id: data.avatar_id || 'pomodoro'
                });
            }
        } catch (err) {
            console.error("Errore nel caricamento profilo:", err);
        } finally {
            setLoading(false);
        }
    };

    // Salva le modifiche (Upsert)
    const saveProfile = async () => {
        if (!session?.user) return;

        const { error } = await supabase.from('profiles').upsert({
            id: session.user.id,
            nickname: profile.nickname,
            avatar_id: profile.avatar_id,
            updated_at: new Date()
        });

        if (!error) {
            setIsEditingProfile(false);
        } else {
            console.error("Errore nel salvataggio profilo:", error);
        }
    };

    // Sincronizzazione al cambio sessione
    useEffect(() => {
        if (session) fetchProfile();
    }, [session]);

    return {
        profile,
        setProfile,
        isEditingProfile,
        setIsEditingProfile,
        saveProfile,
        loading
    };
};
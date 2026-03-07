import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

//tutto questo dipende da session
export const useProfile = (session) => {

    const [profile, setProfile] = useState({ nickname: '', avatar_id: 'pomodoro' });
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [loading, setLoading] = useState(true); //nuovo: si usa quando si sposta da monolite a hooks
    //MA SOLO NEGLI HOOK CHE DEVONO LEGGERE DATI ASINCRONI SCONOSCIUTI
    //motivo: latenza delle chiamate -> uso spinner

    //recupera informazioni del profilo dalla tabella profiles nel database
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

      //hook per side effect: se cambia stato di auth (utente loggato) allora fetcho il profilo
      useEffect(() => {
        if (session) fetchProfile();
    }, [session]);


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


    useEffect(() => {
        if (session) fetchProfile();
    }, [session]);    

    return {
        profile,
        setProfile,
        isEditingProfile,
        setIsEditingProfile,
        saveProfile,
        loading,
    };
}
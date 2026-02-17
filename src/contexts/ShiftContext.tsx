import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from '../components/ui/Toast';

export interface WorkSession {
    id: number;
    user_id: string;
    rol: string;
    started_at: string;
    ended_at?: string;
    status: 'activo' | 'finalizado';
}

interface ShiftContextType {
    currentSession: WorkSession | null;
    loading: boolean;
    startShift: () => Promise<void>;
    endShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
    const { user, profile } = useAuth();
    const { showToast } = useToast();
    // OPTIMIZED: Initialize from LocalStorage to avoid blocking UI
    const [currentSession, setCurrentSession] = useState<WorkSession | null>(() => {
        const cached = localStorage.getItem('locotos_shift_session');
        return cached ? JSON.parse(cached) : null;
    });

    // We still need a loading state, but it shouldn't block if we have cache
    const [loading, setLoading] = useState(!localStorage.getItem('locotos_shift_session'));

    // Global Failsafe
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                console.warn("ShiftContext loading stuck, forcing unlock...");
                setLoading(false);
            }
        }, 6000);
        return () => clearTimeout(timer);
    }, [loading]);

    useEffect(() => {
        if (user) {
            checkActiveSession();
        } else {
            setCurrentSession(null);
            localStorage.removeItem('locotos_shift_session');
            setLoading(false);
        }
    }, [user]);

    async function checkActiveSession() {
        // Don't set global loading to true if we already have data (Background Revalidation)
        if (!currentSession) setLoading(true);

        try {
            // Define query promise explicitly
            const queryPromise = supabase
                .from('work_sessions')
                .select('*')
                .eq('user_id', user?.id)
                .eq('status', 'activo')
                .maybeSingle()
                .then(res => res); // FORCE PROMISE

            // Define timeout promise (5s)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout checking shift')), 5000)
            );

            // Race them
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

            if (error) throw error;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sessionData = data as any;

            if (sessionData) {
                setCurrentSession(sessionData);
                localStorage.setItem('locotos_shift_session', JSON.stringify(sessionData));
            } else {
                setCurrentSession(null);
                localStorage.removeItem('locotos_shift_session');
            }

        } catch (error) {
            console.error('Error checking shift:', error);
            // Keep existing state on error / timeout (Optimistic UI)
        } finally {
            setLoading(false);
        }
    }

    async function startShift() {
        if (!user || !profile) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('work_sessions')
                .insert({
                    user_id: user.id,
                    rol: profile.rol,
                    status: 'activo'
                })
                .select()
                .single();

            if (error) throw error;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newSession = data as any;
            setCurrentSession(newSession);
            localStorage.setItem('locotos_shift_session', JSON.stringify(newSession));

            showToast(`¡Buen trabajo ${profile.nombre_completo}! Turno iniciado.`, 'success');
        } catch (error: any) {
            console.error('Error starting shift:', error);
            showToast('Error al iniciar turno: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function endShift() {
        if (!currentSession) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('work_sessions')
                .update({
                    status: 'finalizado',
                    ended_at: new Date().toISOString()
                })
                .eq('id', currentSession.id);

            if (error) throw error;

            setCurrentSession(null);
            localStorage.removeItem('locotos_shift_session');
            showToast('Turno finalizado. ¡Buen descanso!', 'success');
        } catch (error: any) {
            console.error('Error ending shift:', error);
            showToast('Error al finalizar turno: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <ShiftContext.Provider value={{ currentSession, loading, startShift, endShift }}>
            {children}
        </ShiftContext.Provider>
    );
}

export function useShift() {
    const context = useContext(ShiftContext);
    if (context === undefined) {
        throw new Error('useShift must be used within a ShiftProvider');
    }
    return context;
}

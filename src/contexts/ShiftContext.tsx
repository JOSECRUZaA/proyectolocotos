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
    const [currentSession, setCurrentSession] = useState<WorkSession | null>(null);
    const [loading, setLoading] = useState(true);

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
            setLoading(false);
        }
    }, [user]);

    async function checkActiveSession() {
        setLoading(true); // Ensure verify state is visible during check
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
            setCurrentSession(data as any);
        } catch (error) {
            console.error('Error checking shift:', error);
            // On error/timeout, allow access (assume no active shift or handle otherwise?)
            // If strictly enforcing, maybe we keep currentSession=null so they see Start Screen?
            // Yes, that's safer.
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
            setCurrentSession(data as any);
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

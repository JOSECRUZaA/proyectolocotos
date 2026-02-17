/* eslint-disable */
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    session: Session | null;
    loading: boolean;
    error: string | null;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // 1. Fetch Profile Logic
    async function fetchProfile(userId: string) {
        try {
            setError(null);

            // 5s Timeout for DB
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout al cargar perfil')), 5000)
            );

            const fetchPromise = supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

            if (error) {
                console.error('Error fetching profile:', error);

                setProfile((prev) => {
                    // Try to preserve stale profile if network error
                    if (prev && prev.id === userId) {
                        if (error.code === 'PGRST116') {
                            setError('Perfil no encontrado');
                            return null;
                        }
                        console.warn('Persisting stale profile:', error);
                        return prev;
                    }

                    if (error.code !== 'PGRST116') setError(error.message);
                    return null;
                });
            } else {
                // SINGLE SESSION CHECK
                // Check if the current session matches the one in the database
                const serverSessionId = (data as any).current_session_id;
                const localSessionId = localStorage.getItem('locotos_session_id');

                if (serverSessionId && localSessionId && serverSessionId !== localSessionId) {
                    console.warn('Session mismatch detected. Logging out...');
                    await signOut();
                    return; // Stop execution
                }

                setProfile(data);
            }
        } catch (err: any) {
            console.error('Unexpected auth error:', err);

            setProfile((prev) => {
                if (prev && prev.id === userId) {
                    console.warn('Persisting profile despite exception:', err);
                    return prev;
                }
                setError(err.message || 'Error desconocido');
                return null;
            });
        } finally {
            setLoading(false);
        }
    }

    // 2. Auth Effect
    useEffect(() => {
        let mounted = true;

        // GLOBAL FAILSAFE: If app remains locked for > 3s, force unlock
        const failsafeTimer = setTimeout(() => {
            if (mounted) {
                setLoading((cur) => {
                    if (cur) {
                        console.warn('Authentication took too long, unlocking app...');
                        return false;
                    }
                    return cur;
                });
            }
        }, 3000);

        // Listen for Auth State Changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            console.log('Auth Event:', event);

            setSession(session);
            setUser(session?.user ?? null);

            if (session?.user) {
                // If we have a user, try to get their profile
                await fetchProfile(session.user.id);
            } else {
                // Signed out or no user
                setProfile(null);
                setLoading(false);
            }
        });

        // Initial Session Check (Async)
        // CRITICAL FOR PWA: Sometimes onAuthStateChange doesn't fire 'INITIAL_SESSION' fast enough
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                if (!session) {
                    // If no session found immediately, stop loading
                    console.log('No initial session found (manual check).');
                    setLoading(false);
                } else {
                    // Session found, ensure loading stops eventually
                    setSession(session);
                    setUser(session.user);
                    // Explicitly fetch profile here too in case onAuthStateChange is slow/missed
                    fetchProfile(session.user.id).finally(() => {
                        if (mounted) setLoading(false);
                    });
                }
            }
        });

        return () => {
            mounted = false;
            clearTimeout(failsafeTimer);
            subscription.unsubscribe();
        };
    }, []);

    // 3. Realtime Profile Updates
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel(`profile_updates_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${user.id}`,
                },
                (payload) => {
                    console.log('Profile updated realtime:', payload);

                    // SINGLE SESSION REALTIME CHECK
                    const newProfile = payload.new as any;
                    const serverSessionId = newProfile.current_session_id;
                    const localSessionId = localStorage.getItem('locotos_session_id');

                    if (serverSessionId && localSessionId && serverSessionId !== localSessionId) {
                        console.warn('Remote session takeover detected. Logging out...');
                        signOut(); // This will clear session and user
                        return;
                    }

                    setProfile(payload.new as Profile);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const signOut = async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setUser(null);
        setSession(null);
        setError(null);
        localStorage.removeItem('locotos_session_id');
        localStorage.removeItem('locotos_shift_session'); // Also clear shift cache
    };

    return (
        <AuthContext.Provider value={{ user, session, profile, loading, error, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

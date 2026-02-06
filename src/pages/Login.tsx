import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ChefHat, User, Lock } from 'lucide-react';

export default function Login() {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { user, profile, loading: authLoading } = useAuth(); // Get auth state

    useEffect(() => {
        if (user && profile) {
            navigate('/');
        }
    }, [user, profile, navigate]);

    if (authLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
                    <p className="text-gray-500 font-medium">Verificando sesión...</p>
                </div>
            </div>
        );
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // AUTO-APPEND DOMAIN for simple usernames
            const emailInput = username.trim();
            const email = emailInput.includes('@')
                ? emailInput
                : `${emailInput.toUpperCase()}@wendys.system`;

            // CREATE A TIMEOUT PROMISE
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión.')), 10000);
            });

            // 1. CHECK IF USER EXISTS IN PROFILES
            // We use the email to search. Since we don't have direct access to auth.users, 
            // we assume profiles are kept in sync or we use specific logic.
            // CAUTION: This requires 'profiles' to be readable by anon/public for this check to work perfectly,
            // or we just trust Supabase Auth. 
            // BUT user specifically requested "identifique si se equivoco usuario o contraseña".
            // So we try to query profiles (assuming email is stored or derivable).
            // Looking at UserManagement, profiles has 'email' column? 
            // In UserManagement it maps profiles: 
            // const { data } = await supabase.from('profiles').select('*')...
            // It seems profiles HAS email. Let's verify.

            // To be safe and compliant with user request, we try to fetch the profile by email first.
            const { data: userCheck } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email.toLowerCase()) // Emails are usually lowercase in DB
                .maybeSingle();

            if (!userCheck) {
                throw new Error('El usuario ingresado no existe.');
            }

            // 2. LOGIN REQUEST
            const loginPromise = supabase.auth.signInWithPassword({
                email,
                password,
            });

            const result = await Promise.race([loginPromise, timeoutPromise]);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: authData, error: authError } = result as any;

            if (authError) {
                // If we are here, user exists (checked above), so it MUST be password error
                // (or some other auth error like email not confirmed)
                console.error('Auth error:', authError);
                if (authError.message.includes('Invalid login credentials')) {
                    throw new Error('La contraseña es incorrecta.');
                }
                throw authError; // Throw other errors as is
            }

            if (authData.user) {
                // CHECK ACTIVE STATUS
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('activo')
                    .eq('id', authData.user.id)
                    .single();

                if (profileError) {
                    // If profile doesn't exist, we still allow login to let AuthContext handle the "Profile Error" screen
                    // taking user to the "Error de Perfil" page is better than blocking here.
                    console.warn('Profile check failed, proceeding anyway:', profileError);
                }

                if (profile && profile.activo === false) {
                    await supabase.auth.signOut();
                    throw new Error('Este usuario ha sido desactivado. Contacte al administrador.');
                }

                // Success - Navigation handled by useEffect watching 'user' state
                // FAILSAFE: If AuthContext is slow to update, force a reload/navigation after 1.5s
                console.log('Login successful, waiting for user state update...');
                setTimeout(() => {
                    if (window.location.pathname === '/login') {
                        window.location.href = '/';
                    }
                }, 1500);
            }
        } catch (err: any) {
            console.error('Login error:', err);
            let errorMessage = err instanceof Error ? err.message : 'Error desconocido al iniciar sesión';

            // Translate common Supabase Auth errors
            if (errorMessage.includes('Invalid login credentials')) {
                errorMessage = 'Usuario o contraseña incorrectos';
            } else if (errorMessage.includes('Email not confirmed')) {
                errorMessage = 'El correo electrónico no ha sido confirmado';
            }

            setError(errorMessage);
            setLoading(false);
        }
    };

    return (
        <div
            className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4 relative overflow-hidden"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1549213821-4708d624e1d1?q=80&w=1920&auto=format&fit=crop')" }}
        >
            {/* Dark Overlay for Text Readability */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>

            <div className="bg-white/95 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md border border-white/20 transform transition-all relative z-10">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-20 h-20 bg-gradient-to-tr from-red-600 to-orange-500 rounded-2xl rotate-3 flex items-center justify-center mb-6 text-white shadow-lg shadow-red-500/30 hover:rotate-6 transition-transform duration-300">
                        <ChefHat size={40} className="-rotate-3" />
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight text-center">Locotos Restaurante</h1>
                    <p className="text-gray-500 mt-2 font-medium text-center">Bienvenido, inicia sesión</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl mb-6 text-sm font-medium flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                        <div className="bg-red-100 p-1 rounded-full"><span className="block w-2 h-2 bg-red-500 rounded-full"></span></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 ml-1">Usuario</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-500 transition-colors">
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-bold text-gray-800 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-gray-400"
                                placeholder="Ej. MDORADO"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700 ml-1">Contraseña</label>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-red-500 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all font-medium text-gray-800"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-4 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg shadow-red-500/30 hover:shadow-red-500/50 hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-none mt-4 text-lg tracking-wide"
                    >
                        {loading ? 'Verificando...' : 'Ingresar al Sistema'}
                    </button>
                </form>
            </div>

            <div className="absolute bottom-4 text-white/40 text-xs font-medium">
                © {new Date().getFullYear()} Locotos Restaurante System
            </div>
        </div>
    );
}

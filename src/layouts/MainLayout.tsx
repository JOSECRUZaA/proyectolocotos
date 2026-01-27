import React from 'react';
import { Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast, Toast } from '../components/ui/Toast';
import {
    ChefHat,
    UtensilsCrossed,
    LogOut,
    Users,
    ShoppingBag,
    CircleDollarSign,
    ClipboardList,
    Beer,
    LayoutGrid,
} from 'lucide-react';

import { supabase } from '../lib/supabase';

export default function MainLayout() {
    const { profile, signOut, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
    const [cashStatus, setCashStatus] = React.useState<'abierta' | 'cerrada'>('cerrada');


    // Global Notification State
    const { toast, showToast, hideToast } = useToast();
    const audioCtxRef = React.useRef<AudioContext | null>(null);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    // --- AUDIO LOGIC ---
    const initAudio = () => {
        if (!audioCtxRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContext) {
                audioCtxRef.current = new AudioContext();
            }
        }
        if (audioCtxRef.current?.state === 'suspended') {
            audioCtxRef.current.resume();
        }
    };

    const playNotification = () => {
        try {
            if (!audioCtxRef.current) initAudio();
            const ctx = audioCtxRef.current;
            if (!ctx) return;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            // Tono 1: Ding (Alto)
            // 'osc' and 'gain' are already created above

            osc.type = 'sine';
            osc.frequency.setValueAtTime(660, ctx.currentTime); // Mi (E5)

            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.05); // Attack fast
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5); // Decay

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.6);

            // Tono 2: Dong (Bajo) - Suena 0.4s después
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();

            osc2.connect(gain2);
            gain2.connect(ctx.destination);

            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(550, ctx.currentTime + 0.4); // Do# (C#5) aprox, intervalo melódico

            gain2.gain.setValueAtTime(0, ctx.currentTime + 0.4);
            gain2.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.45);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

            osc2.start(ctx.currentTime + 0.4);
            osc2.stop(ctx.currentTime + 1.5);

            // Vibración
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        } catch (error) {
            console.error('Audio Error:', error);
        }
    };

    // Initialize Audio on Interaction
    React.useEffect(() => {
        const enableAudio = () => initAudio();
        document.addEventListener('click', enableAudio);
        document.addEventListener('touchstart', enableAudio);
        return () => {
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('touchstart', enableAudio);
        };
    }, []);

    // --- GLOBAL SUBSCRIPTION (Ready Orders) ---
    React.useEffect(() => {
        if (!profile || !['garzon', 'administrador', 'cajero'].includes(profile.rol)) return;

        const channel = supabase
            .channel('global_waiter_notifications')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                async (payload) => {
                    const newRecord = payload.new as any;
                    // Trigger only when status changes to 'listo_para_servir'
                    if (payload.eventType === 'UPDATE' && newRecord.estado === 'listo_para_servir') {
                        // ... (existing logic)
                        const { data: orderData } = await supabase
                            .from('orders')
                            .select('numero_mesa')
                            .eq('id', newRecord.order_id)
                            .single();
                        const mesa = orderData?.numero_mesa || '?';
                        playNotification();
                        showToast(`¡Pedido Listo! Mesa ${mesa}`, 'success');
                    }
                }
            )
            .subscribe();

        // 🔔 WAITER CALLS SUBSCRIPTION
        const callChannel = supabase
            .channel('waiter_calls_sub')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
                async (payload) => {
                    const call = payload.new as any;
                    // Check if call is relevant to ME
                    // 1. I am a waiter
                    // 2. It is for ME specifically OR it is for EVERYONE (null)
                    if (profile.rol === 'garzon') {
                        if (call.recipient_waiter_id === profile.id || !call.recipient_waiter_id) {

                            // Play distinctive sound (Ding-Dong-Ding)
                            if (audioCtxRef.current) {
                                const ctx = audioCtxRef.current;
                                const osc = ctx.createOscillator();
                                const gain = ctx.createGain();
                                osc.connect(gain);
                                gain.connect(ctx.destination);
                                osc.frequency.setValueAtTime(800, ctx.currentTime);
                                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
                                osc.start();
                                osc.stop(ctx.currentTime + 0.5);
                            } else {
                                playNotification(); // Fallback
                            }

                            navigator.vibrate?.([500, 200, 500]);

                            const sender = call.sender_role.toUpperCase();
                            showToast(`📢 ${sender} TE SOLICITA ${call.mesa_id ? `- MESA ${call.mesa_id}` : ''}`, 'info');
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(callChannel);
        };
    }, [profile]);






    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    // FETCH & SUBSCRIBE TO CASH STATUS
    React.useEffect(() => {
        const checkCashStatus = async () => {
            const { count } = await supabase
                .from('cash_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'abierta');

            setCashStatus(count && count > 0 ? 'abierta' : 'cerrada');
        };

        checkCashStatus();

        const channel = supabase
            .channel('cash_status_sidebar')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cash_sessions' },
                () => checkCashStatus()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
            <div className="w-16 h-16 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
        </div>
    );

    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen bg-gray-100 flex-col md:flex-row">
            {/* Global Toast */}
            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={hideToast} />

            {/* Mobile Header */}
            <header className="bg-white border-b p-4 flex justify-between items-center md:hidden sticky top-0 z-40 shadow-sm safe-area-top">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                        W
                    </div>
                    <span className="font-bold text-gray-800">Wendy's App</span>
                </div>
                <div className="flex items-center gap-3">


                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg active:bg-gray-200 active:scale-95 transition-all"
                    >
                        {isMobileMenuOpen ? <LogOut size={24} className="rotate-180" /> : <div className="space-y-1.5">
                            <span className="block w-6 h-0.5 bg-gray-800"></span>
                            <span className="block w-6 h-0.5 bg-gray-800"></span>
                            <span className="block w-6 h-0.5 bg-gray-800"></span>
                        </div>}
                    </button>
                </div>
            </header>

            {/* Sidebar (Desktop: Static, Mobile: Fixed Overlay) */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out flex flex-col
                md:relative md:translate-x-0 md:bg-white md:shadow-md
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-black text-gray-800 uppercase tracking-wider">{profile.rol}</h1>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-3 w-3">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cashStatus === 'abierta' ? 'bg-green-400' : 'bg-red-400'
                                    }`}></span>
                                <span className={`relative inline-flex rounded-full h-3 w-3 ${cashStatus === 'abierta' ? 'bg-green-500' : 'bg-red-500'
                                    }`}></span>
                            </span>
                            <span className={`text-xs font-bold uppercase tracking-tight ${cashStatus === 'abierta' ? 'text-green-600' : 'text-red-600'
                                }`}>
                                {cashStatus === 'abierta' ? 'Caja Abierta' : 'Caja Cerrada'}
                            </span>
                        </div>
                    </div>
                    {/* Close Button Mobile Only */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden p-2 text-gray-400 hover:text-gray-600 active:bg-gray-100 rounded-full"
                    >
                        <LogOut size={20} className="rotate-180" /> {/* Reusing Icon for Close */}
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {/* Garzon & Cajero & Admin */}
                    {(['garzon', 'cajero', 'administrador'].includes(profile.rol)) && (
                        <>
                            <NavLink to="/mesas" icon={<UtensilsCrossed size={20} />} label="Mesas & Pedidos" active={location.pathname === '/mesas'} />
                            <NavLink to="/mesas/pedidos" icon={<ClipboardList size={20} />} label="Monitor de Salón" active={location.pathname === '/mesas/pedidos'} />
                        </>
                    )}

                    {/* Kitchen / Bar Monitors */}
                    <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">Producción</div>
                    <NavLink to="/cocina" icon={<ChefHat size={20} />} label="Monitor Cocina" active={location.pathname === '/cocina'} />
                    <NavLink to="/bar" icon={<Beer size={20} />} label="Monitor Bar" active={location.pathname === '/bar'} />

                    {/* Cajero & Admin */}
                    {['cajero', 'administrador'].includes(profile.rol) && (
                        <>
                            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">Caja</div>
                            <NavLink to="/caja" icon={<CircleDollarSign size={20} />} label="Gestión de Caja" active={location.pathname === '/caja'} />
                            <NavLink to="/ventas-diarias" icon={<ClipboardList size={20} />} label="Ventas del Día" active={location.pathname === '/ventas-diarias'} />
                            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">Sistema</div>
                            <NavLink to="/admin/online" icon={<Users size={20} />} label="Usuarios Online" active={location.pathname === '/admin/online'} />
                        </>
                    )}

                    {/* Admin Only */}
                    {profile.rol === 'administrador' && (
                        <>
                            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">Administración</div>
                            <NavLink to="/admin/mesas" icon={<LayoutGrid size={20} />} label="Mesas" active={location.pathname === '/admin/mesas'} />
                            <NavLink to="/admin/usuarios" icon={<Users size={20} />} label="Usuarios" active={location.pathname === '/admin/usuarios'} />
                            <NavLink to="/admin/reportes" icon={<ClipboardList size={20} />} label="Reportes" active={location.pathname === '/admin/reportes'} />
                        </>
                    )}

                    {/* Marketing / Products (Admin & Cajero) */}
                    {['administrador', 'cajero'].includes(profile.rol) && (
                        <>
                            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase">Marketing & Menú</div>
                            <NavLink to="/admin/productos" icon={<ShoppingBag size={20} />} label="Productos" active={location.pathname === '/admin/productos'} />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                            {profile.nombre_completo.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium truncate">{profile.nombre_completo}</p>
                            <p className="text-xs text-gray-500 capitalize">{profile.rol}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                        <LogOut size={16} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Overlay Background for Mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm animate-in fade-in"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto p-4 md:p-8 relative w-full">
                <Outlet />
            </main>
        </div>
    );
}

function NavLink({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
    return (
        <Link
            to={to}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${active
                ? 'bg-red-50 text-red-600 font-medium shadow-sm'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 active:bg-gray-100 active:scale-95'
                }`}
        >
            {icon}
            <span>{label}</span>
        </Link>
    );
}

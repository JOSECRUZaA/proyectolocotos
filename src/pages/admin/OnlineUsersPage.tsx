import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useOnlineUsers } from '../../contexts/OnlineUsersContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { User, Shield, ChefHat, Beer, Laptop, Clock, UtensilsCrossed, BellRing } from 'lucide-react';

export default function OnlineUsersPage() {
    const { onlineUsers } = useOnlineUsers();
    const { profile } = useAuth();
    const { showToast } = useToast();
    const [waiterStats, setWaiterStats] = useState<Record<string, number>>({});
    const [callingUser, setCallingUser] = useState<string | null>(null);

    useEffect(() => {
        fetchWaiterStats();

        // Realtime subscription for metrics
        const channel = supabase
            .channel('waiter_stats')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => fetchWaiterStats()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchWaiterStats() {
        // Count active tables per waiter
        const { data } = await supabase
            .from('orders')
            .select('garzon_id, numero_mesa')
            .in('estado', ['pendiente', 'en_proceso', 'servido']); // Active tables (not paid/cancelled)

        if (data) {
            const stats = data.reduce((acc, order) => {
                const gid = order.garzon_id;
                if (!gid) return acc;
                acc[gid] = (acc[gid] || 0) + 1; // Count orders (usually 1 per active table session)
                return acc;
            }, {} as Record<string, number>);
            setWaiterStats(stats);
        }
    }

    const handleCallUser = async (targetUserId: string, targetName: string) => {
        if (!profile) return;
        setCallingUser(targetUserId);

        try {
            const { error } = await supabase
                .from('waiter_calls')
                .insert({
                    mesa_id: null, // Direct call, no table
                    sender_role: profile.rol,
                    sender_user_id: profile.id, // I am calling
                    recipient_waiter_id: targetUserId, // You are receiving
                    message: `📢 LLAMADA DIRECTA DE ${profile.nombre_completo.toUpperCase()} (${profile.rol.toUpperCase()})`,
                    status: 'pending'
                });

            if (error) throw error;
            showToast(`🔔 Llamando a ${targetName}...`, 'success');
        } catch (error: any) {
            console.error('Error calling user:', error);
            showToast('Error al llamar usuario', 'error');
        } finally {
            setTimeout(() => setCallingUser(null), 2000); // Reset loading state
        }
    };

    const getRoleIcon = (rol: string) => {
        switch (rol) {
            case 'administrador': return <Shield size={20} className="text-purple-600" />;
            case 'cocina': return <ChefHat size={20} className="text-orange-600" />;
            case 'bar': return <Beer size={20} className="text-blue-600" />;
            case 'cajero': return <Laptop size={20} className="text-green-600" />;
            case 'garzon': return <UtensilsCrossed size={20} className="text-pink-600" />;
            default: return <User size={20} className="text-gray-600" />;
        }
    };

    const getRoleColor = (rol: string) => {
        switch (rol) {
            case 'administrador': return 'bg-purple-50 border-purple-200 text-purple-900';
            case 'cocina': return 'bg-orange-50 border-orange-200 text-orange-900';
            case 'bar': return 'bg-blue-50 border-blue-200 text-blue-900';
            case 'cajero': return 'bg-green-50 border-green-200 text-green-900';
            case 'garzon': return 'bg-pink-50 border-pink-200 text-pink-900';
            default: return 'bg-gray-50 border-gray-200 text-gray-900';
        }
    };

    // Group users by role
    const grouped = onlineUsers.reduce((acc, user) => {
        const rol = user.rol || 'desconocido';
        if (!acc[rol]) acc[rol] = [];
        acc[rol].push(user);
        return acc;
    }, {} as Record<string, typeof onlineUsers>);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <span className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
                    </span>
                    Usuarios Conectados ({onlineUsers.length})
                </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Object.entries(grouped).map(([rol, users]) => (
                    <div key={rol} className="bg-white rounded-xl shadow p-4 border h-fit">
                        <div className="flex items-center gap-2 mb-4 border-b pb-2">
                            {getRoleIcon(rol)}
                            <h2 className="font-bold capitalize text-gray-700">{rol}</h2>
                            <span className="bg-gray-100 text-xs px-2 py-0.5 rounded-full text-gray-600 font-bold ml-auto">
                                {users.length}
                            </span>
                        </div>

                        <div className="space-y-3">
                            {users.map(u => (
                                <div key={u.id} className={`relative flex items-center gap-3 p-2 rounded-lg border ${getRoleColor(u.rol)}`}>
                                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-sm shadow-sm uppercase overflow-hidden text-gray-700 border-2 border-opacity-10 shrink-0">
                                        {u.nombre_completo.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden flex-1 min-w-0">
                                        <p className="font-bold text-sm truncate">{u.nombre_completo}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <p className="text-[10px] flex items-center gap-1 opacity-75 leading-tight whitespace-nowrap">
                                                <Clock size={10} />
                                                {new Date(u.online_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>

                                            {/* METRIC: Active Tables for Waiters */}
                                            {u.rol === 'garzon' && (
                                                <div className="flex items-center gap-1 bg-white/50 px-1.5 py-0.5 rounded text-[10px] font-bold text-pink-700 whitespace-nowrap">
                                                    <UtensilsCrossed size={10} />
                                                    {waiterStats[u.id] || 0}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="ml-auto flex items-center gap-2">
                                        {u.id !== profile?.id && (
                                            <button
                                                onClick={() => handleCallUser(u.id, u.nombre_completo)}
                                                disabled={callingUser === u.id}
                                                className={`p-2 rounded-full transition-all shadow-sm ${callingUser === u.id
                                                    ? 'bg-red-100 text-red-400 cursor-wait animate-pulse'
                                                    : 'bg-white hover:bg-red-500 hover:text-white text-gray-400'}`}
                                                title={`Llamar a ${u.nombre_completo}`}
                                            >
                                                <BellRing size={16} className={callingUser === u.id ? 'animate-bounce' : ''} />
                                            </button>
                                        )}
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-200 animate-pulse shrink-0"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}

                {onlineUsers.length === 0 && (
                    <div className="col-span-full p-8 text-center text-gray-400">
                        No hay usuarios conectados (¿Cómo estás viendo esto?)
                    </div>
                )}
            </div>
        </div>
    );
}

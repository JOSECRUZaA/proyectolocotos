import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../types/database.types';
import { Users, Utensils, FileText, AlertCircle, User } from 'lucide-react';

type Table = Database['public']['Tables']['mesas']['Row'];

interface TableWithWaiter extends Table {
    waiter_name?: string;
}

export default function TableMap() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [tables, setTables] = useState<TableWithWaiter[]>([]);
    const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
    const [loading, setLoading] = useState(true);

    const handleTableClick = async (table: Table) => {
        // CASE 1: Cashier accessing a Free Table -> BLOCK
        if (profile?.rol === 'cajero' && table.estado === 'libre') {
            setErrorModal({
                show: true,
                title: 'Función Restringida',
                message: 'El Cajero NO puede abrir mesas ni tomar pedidos. Por favor, delegue esta acción a un Mesero.'
            });
            return;
        }

        // CASE 2: Cashier accessing an Occupied Table -> Go to Payment
        if (['cajero', 'administrador'].includes(profile?.rol || '') && table.estado !== 'libre') {
            navigate(`/caja/cobrar/${table.numero_mesa}`);
            return;
        }

        // NEW CHECK: Verify if there is an active Cashier Session (Open Box)
        // We do this check before allowing a Waiter to open a new order/table
        if (table.estado === 'libre') {
            const { count } = await supabase
                .from('cash_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'abierta');

            if (count === 0) {
                setErrorModal({
                    show: true,
                    title: '¡Acción Denegada!',
                    message: 'No hay ninguna Caja Abierta en el sistema. No se pueden tomar pedidos hasta que un Cajero inicie turno.'
                });
                return;
            }
        }

        // CASE 3: Waiter/Admin accessing any table -> Go to Order
        navigate(`/mesas/${table.numero_mesa}/nueva-orden`);
    };

    useEffect(() => {
        fetchTables();

        // Realtime subscription
        const channel = supabase
            .channel('table_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'mesas' },
                (_payload) => {

                    fetchTables(); // Refresh on any change
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchTables() {
        try {
            const { data: tablesData, error } = await supabase
                .from('mesas')
                .select('*')
                .order('numero_mesa');

            if (error) throw error;

            let enrichedTables: TableWithWaiter[] = tablesData || [];

            // Fetch waiter info manually to avoid ambiguous FK joins
            const activeOrderIds = enrichedTables
                .filter(t => t.orden_actual_id)
                .map(t => t.orden_actual_id);

            if (activeOrderIds.length > 0) {
                // 1. Get Orders to find Garzon IDs
                const { data: ordersData } = await supabase
                    .from('orders')
                    .select('id, garzon_id')
                    .in('id', activeOrderIds);

                const garzonIds = ordersData
                    ?.map(o => o.garzon_id)
                    .filter(Boolean) as string[] || [];

                if (garzonIds.length > 0) {
                    // 2. Get Profiles
                    const { data: profilesData } = await supabase
                        .from('profiles')
                        .select('id, nombre_completo')
                        .in('id', garzonIds);

                    // 3. Map it back
                    const profileMap = new Map(profilesData?.map(p => [p.id, p.nombre_completo]));
                    const orderGarzonMap = new Map(ordersData?.map(o => [o.id, o.garzon_id]));

                    enrichedTables = enrichedTables.map(t => {
                        const garzonId = t.orden_actual_id ? orderGarzonMap.get(t.orden_actual_id) : null;
                        const waiterName = garzonId ? profileMap.get(garzonId) : undefined;
                        return { ...t, waiter_name: waiterName };
                    });
                }
            }

            setTables(enrichedTables);
        } catch (error) {
            console.error('Error fetching tables:', error);
        } finally {
            setLoading(false);
        }
    }

    const getCardStyles = (status: string) => {
        switch (status) {
            case 'libre':
                return 'bg-white border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-100/50 text-gray-700';
            case 'ocupada':
                return 'bg-white border-red-200 hover:border-red-400 hover:shadow-red-100/50 text-gray-700';
            case 'pidio_cuenta':
                return 'bg-yellow-50 border-yellow-300 hover:border-yellow-500 hover:shadow-yellow-100/50 text-gray-800 animate-pulse-slow';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'libre':
                return <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide">Libre</span>;
            case 'ocupada':
                return <span className="px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wide">Ocupada</span>;
            case 'pidio_cuenta':
                return <span className="px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 text-xs font-bold uppercase tracking-wide">Pidiendo Cuenta</span>;
            default: return null;
        }
    };

    if (loading) return (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 animate-pulse">
            {[...Array(10)].map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-2xl"></div>
            ))}
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Mapa de Mesas</h1>
                    <p className="text-gray-500">Gestina el estado de las mesas en tiempo real.</p>
                </div>

                <div className="flex bg-white p-2 rounded-xl border border-gray-100 shadow-sm gap-4 text-xs font-bold text-gray-600">
                    <div className="flex items-center gap-2 px-2">
                        <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-sm shadow-emerald-200"></span> Libre
                    </div>
                    <div className="flex items-center gap-2 px-2">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-sm shadow-red-200"></span> Ocupada
                    </div>
                    <div className="flex items-center gap-2 px-2">
                        <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full shadow-sm shadow-yellow-200 animate-pulse"></span> Pidiendo Cuenta
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {tables.map(table => (
                    <button
                        key={table.id}
                        onClick={() => handleTableClick(table)}
                        className={`
                            group relative aspect-square p-6 rounded-2xl border-2 transition-all duration-200
                            flex flex-col justify-between items-center shadow-sm hover:shadow-xl hover:-translate-y-1
                            active:scale-95 active:shadow-inner
                            ${getCardStyles(table.estado)}
                        `}
                    >
                        {/* Status Badge Top */}
                        <div className="w-full flex justify-between items-start">
                            <div className={`p-2 rounded-lg ${table.estado === 'libre' ? 'bg-emerald-50 text-emerald-600' : (table.estado === 'ocupada' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600')}`}>
                                {table.estado === 'libre' ? <Users size={18} /> : (table.estado === 'ocupada' ? <Utensils size={18} /> : <FileText size={18} />)}
                            </div>
                            {table.estado !== 'libre' && (
                                <span className="flex h-3 w-3 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                </span>
                            )}
                        </div>

                        {/* Table Number */}
                        <div className="text-center">
                            <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 block">Mesa</span>
                            <span className="text-5xl font-black tracking-tighter text-gray-900 group-hover:scale-110 transition-transform block">
                                {table.numero_mesa}
                            </span>
                        </div>

                        {/* Footer Info */}
                        <div className="w-full text-center border-t border-gray-100 pt-3 mt-2">
                            {getStatusBadge(table.estado)}

                            {table.waiter_name && (
                                <div className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-100 py-1 px-2 rounded-full mx-auto w-fit">
                                    <User size={12} className="text-gray-500" />
                                    <span className="truncate max-w-[120px]">
                                        {table.waiter_name.split(' ')[0]}
                                    </span>
                                </div>
                            )}

                            <p className="text-xs text-gray-400 font-semibold mt-2">
                                Capacidad: {table.capacidad}p
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            {/* ERROR MODAL */}
            {errorModal.show && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all scale-100 animate-in zoom-in-95">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                                <AlertCircle size={32} className="text-red-600" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">
                                {errorModal.title}
                            </h3>
                            <p className="text-gray-500 mb-6">
                                {errorModal.message}
                            </p>
                            <button
                                onClick={() => setErrorModal({ ...errorModal, show: false })}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-200"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

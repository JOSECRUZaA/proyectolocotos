/* eslint-disable */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database.types';
import { CheckCircle, Clock, Utensils, Beer, BellRing, History, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { WaiterCallModal } from '../components/WaiterCallModal';

type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
    products: Database['public']['Tables']['products']['Row'];
    orders: Database['public']['Tables']['orders']['Row'];
};

export default function ProductionView({ area }: { area?: 'cocina' | 'bar' }) {
    const { profile } = useAuth();
    const [items, setItems] = useState<OrderItem[]>([]);
    const [historyItems, setHistoryItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [profileMap, setProfileMap] = useState<Record<string, string>>({});
    const [viewMode, setViewMode] = useState<'pending' | 'history'>('pending');
    const [now, setNow] = useState(new Date());

    const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
    const [callContext, setCallContext] = useState<{ mesaId?: number } | null>(null);

    // Simple beep sound (Data URI to avoid external dependencies)
    const playNotificationSound = () => {
        try {
            // Notification sound from external URL (fallback or host your own)
            // Using a reliable CDN for a simple 'ding'
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.volume = 0.7;
            audio.play().catch(e => console.log('Audio play failed (user interaction needed):', e));
        } catch (error) {
            console.error('Audio error:', error);
        }
    };

    useEffect(() => {
        fetchProfiles();
        const interval = setInterval(() => setNow(new Date()), 60000); // Update every minute
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (viewMode === 'pending') fetchPendingItems();
        if (viewMode === 'history') fetchHistoryItems();

        const channel = supabase
            .channel('production_updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => {
                    if (viewMode === 'pending') fetchPendingItems();
                    if (viewMode === 'history') fetchHistoryItems();

                    if (payload.eventType === 'INSERT') {
                        // Only play sound if the item belongs to this area
                        // Optimistically play, fetching will filter anyway
                        playNotificationSound();

                        // Vibrate for mobile devices
                        if (typeof navigator !== 'undefined' && navigator.vibrate) {
                            navigator.vibrate([200, 100, 200]);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [area, viewMode]);

    async function fetchProfiles() {
        const { data } = await supabase.from('profiles').select('id, nombre_completo');
        if (data) {
            const map: Record<string, string> = {};
            data.forEach(p => map[p.id] = p.nombre_completo);
            setProfileMap(map);
        }
    }

    async function fetchPendingItems() {
        setLoading(true);
        let query = supabase
            .from('order_items')
            .select('*, products!inner(*), orders!inner(numero_mesa, garzon_id, estado, daily_order_number)')
            .in('estado', ['pendiente', 'en_preparacion'])
            .neq('orders.estado', 'cancelado')
            .order('created_at', { ascending: true });

        if (area) {
            query = query.eq('products.area', area);
        }

        const { data } = await query;
        setItems((data as any) || []);
        setLoading(false);
    }

    async function fetchHistoryItems() {
        setLoading(true);
        // Get last 50 completed items
        let query = supabase
            .from('order_items')
            .select('*, products!inner(*), orders!inner(numero_mesa, garzon_id, daily_order_number)')
            .eq('estado', 'listo_para_servir')
            .order('updated_at', { ascending: false })
            .limit(50);

        if (area) {
            query = query.eq('products.area', area);
        }

        const { data } = await query;
        setHistoryItems((data as any) || []);
        setLoading(false);
    }

    const markAsReady = async (itemId: number) => {
        await supabase
            .from('order_items')
            .update({ estado: 'listo_para_servir' as const, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        // fetchPendingItems() called by subscription
    };

    const undoItem = async (itemId: number) => {
        await supabase
            .from('order_items')
            .update({ estado: 'pendiente' as const })
            .eq('id', itemId);
        // fetchHistoryItems() called by subscription
    };

    if (loading && items.length === 0 && historyItems.length === 0) return <div className="p-8">Cargando pedidos...</div>;

    // Agrupar items por ORDEN (ID de la orden)
    const groupedItems = items.reduce((acc, item) => {
        const orderId = item.order_id;
        if (!acc[orderId]) acc[orderId] = [];
        acc[orderId].push(item);
        return acc;
    }, {} as Record<number, OrderItem[]>);

    const getTitle = () => {
        if (area === 'cocina') return 'Cola de Cocina';
        if (area === 'bar') return 'Cola de Bar';
        return 'Cola de Producción Global';
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Clock className="text-orange-500" />
                    {getTitle()}
                </h1>

                {/* TABS */}
                <div className="flex bg-gray-200 p-1 rounded-lg">
                    <button
                        onClick={() => setViewMode('pending')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'pending' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        Pendientes
                    </button>
                    <button
                        onClick={() => setViewMode('history')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'history' ? 'bg-white text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                        <div className="flex items-center gap-2">
                            <History size={16} />
                            <span>Historial</span>
                        </div>
                    </button>
                </div>

                {profile?.rol !== 'garzon' && (
                    <button
                        onClick={() => { setCallContext(null); setIsWaiterModalOpen(true); }}
                        className="ml-auto flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-100 font-bold text-sm transition-colors"
                    >
                        <BellRing size={18} />
                        Llamar a Garzón
                    </button>
                )}
            </div>

            {/* SOUND TEST BUTTON */}
            <button onClick={playNotificationSound} className="text-xs text-gray-400 hover:text-gray-600 underline">
                [Probar Sonido]
            </button>

            {viewMode === 'pending' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Object.entries(groupedItems)
                        .sort(([, itemsA], [, itemsB]) => {
                            // Ordenar por hora de creación del PRIMER item de la orden
                            const dateA = new Date(itemsA[0].created_at).getTime();
                            const dateB = new Date(itemsB[0].created_at).getTime();
                            return dateA - dateB;
                        })
                        .map(([orderId, orderItems]) => {
                            // Ordenar items dentro de la orden
                            orderItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

                            const oldestItemTime = new Date(orderItems[0].created_at);
                            const elapsedMinutes = Math.floor((now.getTime() - oldestItemTime.getTime()) / 60000);

                            // Extract Order Details from first item
                            const order = orderItems[0].orders;
                            const mesa = order.numero_mesa;
                            const dailyNumber = order.daily_order_number;
                            const garzonId = (order as any).garzon_id;
                            const garzonName = profileMap[garzonId] || 'Sin Asignar';

                            // Traffic Light Logic
                            let headerColor = 'bg-gray-800'; // Default/Safe (< 15m)
                            let timerColor = 'text-green-400';

                            if (elapsedMinutes >= 30) {
                                headerColor = 'bg-red-600 animate-pulse'; // Critical
                                timerColor = 'text-white font-black';
                            } else if (elapsedMinutes >= 15) {
                                headerColor = 'bg-yellow-600'; // Warning
                                timerColor = 'text-white font-bold';
                            }

                            return (
                                <div key={orderId} className="bg-white rounded-xl shadow-md border overflow-hidden flex flex-col">
                                    {/* Cabecera de la Tarjeta (Mesa) con Semáforo */}
                                    <div className={`${headerColor} text-white p-4 transition-colors duration-500`}>
                                        <div className="flex justify-between items-start">
                                            {/* Left Side: Table & Waiter */}
                                            <div className="flex flex-col justify-between h-full">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-xs font-bold opacity-80 uppercase tracking-wider">Mesa</span>
                                                    <h2 className="text-4xl font-black leading-none">{mesa}</h2>
                                                </div>

                                                <div className="flex items-center gap-2 mt-2 text-xs font-medium opacity-90">
                                                    <span>👤 {garzonName.split(' ')[0]}</span>
                                                    {profile?.rol !== 'garzon' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setCallContext({ mesaId: Number(mesa) });
                                                                setIsWaiterModalOpen(true);
                                                            }}
                                                            className="p-1 bg-white/20 hover:bg-white/40 rounded-full transition-colors"
                                                            title={`Llamar mesero para Mesa ${mesa}`}
                                                        >
                                                            <BellRing size={12} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right Side: Timer & Order Number */}
                                            <div className="flex flex-col items-end gap-2">
                                                <div className={`flex items-center gap-1 text-xl font-mono ${timerColor}`}>
                                                    <Clock size={20} />
                                                    <span>{elapsedMinutes} min</span>
                                                </div>

                                                {/* Daily Order Number (Single) */}
                                                {dailyNumber && (
                                                    <span className="bg-white text-gray-900 border-2 border-gray-900 px-3 py-1 rounded-md text-2xl font-black font-mono shadow-[2px_2px_0px_rgba(0,0,0,0.3)]">
                                                        #{dailyNumber}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Lista de Items */}
                                    <div className="p-2 flex-1 space-y-2 bg-gray-50">
                                        {orderItems.map(item => {
                                            const isKitchen = item.products.area === 'cocina';
                                            const textColor = isKitchen ? 'text-orange-900' : 'text-blue-900';
                                            const Icon = isKitchen ? Utensils : Beer;

                                            // PERMISSION LOGIC
                                            const canUpdate =
                                                profile?.rol === 'administrador' ||
                                                profile?.rol === 'cajero' ||
                                                (profile?.rol === 'cocina' && isKitchen) ||
                                                (profile?.rol === 'bar' && !isKitchen);

                                            const showButton = canUpdate;

                                            return (
                                                <div key={item.id} className="relative flex group">
                                                    {/* Left: Quantity Badge (Huge) */}
                                                    <div className={`
                                                    w-20 lg:w-24 flex-shrink-0 flex flex-col items-center justify-center p-2 rounded-l-xl border-y border-l
                                                    ${isKitchen ? 'bg-orange-600 text-white border-orange-700' : 'bg-blue-600 text-white border-blue-700'}
                                                `}>
                                                        <span className="text-4xl lg:text-5xl font-black tracking-tighter">
                                                            {item.cantidad}
                                                        </span>
                                                        <span className="text-xs uppercase font-bold opacity-80">UNID</span>
                                                    </div>

                                                    {/* Right: Details & Action */}
                                                    <div className={`
                                                    flex-1 flex flex-col justify-between p-3 rounded-r-xl border-y border-r border-gray-200 bg-white
                                                    ${item.nota_especial ? 'border-l-4 border-l-red-500' : ''}
                                                `}>
                                                        <div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <h3 className={`text-lg lg:text-xl font-black leading-tight ${textColor}`}>
                                                                    {item.products.nombre}
                                                                </h3>
                                                                <div className={`p-1.5 rounded-full flex-shrink-0 ${isKitchen ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                                                    <Icon size={16} />
                                                                </div>
                                                            </div>

                                                            {item.nota_especial && (
                                                                <div className="mt-2 text-sm bg-red-50 text-red-700 font-bold px-2 py-1.5 rounded border border-red-200 flex items-start gap-1">
                                                                    <span className="text-red-500 text-xs">⚠️</span>
                                                                    {item.nota_especial}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Action Button */}
                                                        {showButton && (
                                                            <button
                                                                onClick={() => markAsReady(item.id)}
                                                                className={`
                                                                w-full mt-3 py-2 rounded-lg font-bold text-sm uppercase flex items-center justify-center gap-2 transition-all
                                                                ${isKitchen
                                                                        ? 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                                                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'}
                                                            `}
                                                            >
                                                                <CheckCircle size={18} />
                                                                <span>Marcar Listo</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                    {items.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-xl border-dashed border-2">
                            <CheckCircle size={48} className="mb-4 text-gray-300" />
                            <p className="text-lg font-medium">Todo está tranquilo por aquí</p>
                            <p className="text-sm">No hay pedidos pendientes en {area || 'producción'}</p>
                        </div>
                    )}
                </div>
            ) : (
                /** HISTORY VIEW */
                <div className="bg-white rounded-xl shadow border overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="p-4 font-bold text-gray-500 text-xs uppercase">Hora Terminado</th>
                                <th className="p-4 font-bold text-gray-500 text-xs uppercase">Mesa</th>
                                <th className="p-4 font-bold text-gray-500 text-xs uppercase">Producto</th>
                                <th className="p-4 font-bold text-gray-500 text-xs uppercase text-right">Cantidad</th>
                                <th className="p-4 font-bold text-gray-500 text-xs uppercase text-right">Acción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {historyItems.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-sm text-gray-500">
                                        {new Date(item.updated_at || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="p-4 font-bold text-gray-700">
                                        Mesa {item.orders.numero_mesa}
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-gray-900">{item.products.nombre}</div>
                                        {item.nota_especial && <span className="text-xs text-red-500 font-medium">Nota: {item.nota_especial}</span>}
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-lg">
                                        {item.cantidad}
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => undoItem(item.id)}
                                            className="flex items-center gap-2 ml-auto text-indigo-600 hover:text-indigo-900 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded transition-colors"
                                        >
                                            <RotateCcw size={14} />
                                            <span>DESHACER</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {historyItems.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">
                                        No hay items terminados recientemente
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <WaiterCallModal
                isOpen={isWaiterModalOpen}
                onClose={() => setIsWaiterModalOpen(false)}
                mesaId={callContext?.mesaId}
                senderRole={area || 'cocina'}
            />
        </div >
    );
}

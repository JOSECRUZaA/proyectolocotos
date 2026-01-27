import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Banknote, TrendingUp, Calendar, Eye, X, ChefHat, Beer, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
    products: Database['public']['Tables']['products']['Row']
};

export default function DailySales() {
    const { profile } = useAuth();
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [sales, setSales] = useState<Order[]>([]);
    const [activeOrders, setActiveOrders] = useState<Order[]>([]); // New State
    const [loading, setLoading] = useState(true);
    const [profileMap, setProfileMap] = useState<Record<string, string>>({});
    const [selectedOrder, setSelectedOrder] = useState<number | null>(null);
    const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
    const [loadingDetails, setLoadingDetails] = useState(false);

    // Analytics
    const [analytics, setAnalytics] = useState({
        kitchen: 0,
        bar: 0
    });

    useEffect(() => {
        fetchProfiles();
        fetchAllData();

        const channel = supabase
            .channel('sales_update')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                () => {
                    fetchAllData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchAllData() {
        setLoading(true);
        await Promise.all([fetchDailySales(), fetchActiveOrders()]);
        setLoading(false);
    }

    async function fetchActiveOrders() {
        const { data } = await supabase
            .from('orders')
            .select('*')
            .neq('estado', 'pagado')
            .neq('estado', 'cancelado')
            .order('created_at', { ascending: true });
        setActiveOrders(data || []);
    }

    async function fetchProfiles() {
        const { data } = await supabase.from('profiles').select('id, nombre_completo');
        if (data) {
            const map: Record<string, string> = {};
            data.forEach(p => map[p.id] = p.nombre_completo);
            setProfileMap(map);
        }
    }

    // Fetch details when an order is selected
    useEffect(() => {
        if (selectedOrder) {
            fetchOrderDetails(selectedOrder);
        } else {
            setOrderItems([]);
        }
    }, [selectedOrder]);

    async function fetchDailySales() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // 1. Fetch Orders
        const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('estado', 'pagado')
            .gte('created_at', todayISO)
            .order('updated_at', { ascending: false });

        setSales(ordersData || []);

        // 2. Fetch Analytics (Breakdown by Area)
        if (ordersData && ordersData.length > 0) {
            const orderIds = ordersData.map(o => o.id);

            const { data: itemsData } = await supabase
                .from('order_items')
                .select('quantity:cantidad, price:precio_unitario, products!inner(area)')
                .in('order_id', orderIds);

            let kitchenTotal = 0;
            let barTotal = 0;

            if (itemsData) {
                itemsData.forEach((item: any) => {
                    const subtotal = item.quantity * item.price;
                    if (item.products.area === 'cocina') {
                        kitchenTotal += subtotal;
                    } else if (item.products.area === 'bar') {
                        barTotal += subtotal;
                    }
                });
            }

            setAnalytics({ kitchen: kitchenTotal, bar: barTotal });
        } else {
            setAnalytics({ kitchen: 0, bar: 0 });
        }
    }

    async function fetchOrderDetails(orderId: number) {
        setLoadingDetails(true);
        const { data, error } = await supabase
            .from('order_items')
            .select('*, products(*)')
            .eq('order_id', orderId);

        if (!error && data) {
            setOrderItems(data as any);
        }
        setLoadingDetails(false);
    }

    async function handleCancelOrder(order: Order) {
        if (!window.confirm(`⚠️ ¿Estás seguro de CANCELAR la Orden #${order.id}?\n\nEsta acción es irreversible y liberará la Mesa ${order.numero_mesa}.`)) {
            return;
        }

        try {
            // 1. Mark Order as Cancelled
            const { error: orderError } = await supabase
                .from('orders')
                .update({ estado: 'cancelado' })
                .eq('id', order.id);

            if (orderError) throw orderError;

            // 2. Free the Table
            const { error: tableError } = await supabase
                .from('mesas')
                .update({
                    estado: 'libre',
                    orden_actual_id: null
                })
                .eq('numero_mesa', order.numero_mesa);

            if (tableError) throw tableError;

            alert('✅ Orden cancelada correctamente.');
            fetchAllData(); // Refresh ALL lists

        } catch (error: any) {
            console.error('Error cancelling order:', error);
            alert('❌ Error al cancelar: ' + error.message);
        }
    }

    const totalSales = sales.reduce((acc, order) => acc + order.total, 0);

    if (loading) return <div className="p-8">Cargando datos...</div>;

    const selectedOrderData = [...sales, ...activeOrders].find(o => o.id === selectedOrder);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gestión de Caja</h1>
                    <p className="text-gray-500 flex items-center gap-2 mt-1">
                        <Calendar size={18} />
                        {format(new Date(), 'dd/MM/yyyy')}
                    </p>
                </div>
            </div>

            {/* TABS SWITCHER */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('active')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'active'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    En Curso ({activeOrders.length})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${activeTab === 'history'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                        }`}
                >
                    Historial Ventas
                </button>
            </div>

            {/* TAB CONTENT: ACTIVE ORDERS */}
            {activeTab === 'active' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-4 border-b bg-yellow-50/50 flex items-center gap-2 text-yellow-800">
                        <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                        <span className="text-sm font-bold">Pedidos Pendientes de Cobro</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[800px]">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 font-semibold text-gray-700">N°</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">Inicio</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">Mesa</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700">Mesero</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-center">Estado</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-right">Total Actual</th>
                                    <th className="px-6 py-4 font-semibold text-gray-700 text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-gray-800">
                                            #{order.daily_order_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-gray-900 text-lg gap-2">
                                            Mesa {order.numero_mesa}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                                    {profileMap[order.garzon_id || '']?.charAt(0) || '?'}
                                                </div>
                                                {profileMap[order.garzon_id || '']?.split(' ')[0] || '---'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold uppercase tracking-wide">
                                                {order.estado}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                            Bs {order.total.toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => setSelectedOrder(order.id)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                title="Ver Productos"
                                            >
                                                <Eye size={20} />
                                            </button>

                                            {profile?.rol === 'cajero' && (
                                                <button
                                                    onClick={() => handleCancelOrder(order)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                                    title="Cancelar Pedido & Liberar Mesa"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {activeOrders.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                            <div className="flex flex-col items-center">
                                                <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-3">
                                                    <div className="w-6 h-6 border-2 border-green-200 rounded-full" />
                                                </div>
                                                <p>Todo tranquilo. No hay pedidos pendientes.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: HISTORY (Existing) */}
            {activeTab === 'history' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* ANALYTICS CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Card */}
                        <div className="bg-green-50 px-6 py-4 rounded-xl border border-green-100 flex items-center gap-4">
                            <div className="p-3 bg-green-100 text-green-700 rounded-full">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-green-800">Total Recaudado</p>
                                <p className="text-3xl font-bold text-green-700">Bs {totalSales.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Kitchen Card */}
                        <div className="bg-orange-50 px-6 py-4 rounded-xl border border-orange-100 flex items-center gap-4">
                            <div className="p-3 bg-orange-100 text-orange-700 rounded-full">
                                <ChefHat size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-orange-800">Ventas Cocina</p>
                                <p className="text-2xl font-bold text-orange-700">Bs {analytics.kitchen.toFixed(2)}</p>
                            </div>
                        </div>

                        {/* Bar Card */}
                        <div className="bg-blue-50 px-6 py-4 rounded-xl border border-blue-100 flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-700 rounded-full">
                                <Beer size={24} />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-blue-800">Ventas Bar</p>
                                <p className="text-2xl font-bold text-blue-700">Bs {analytics.bar.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[800px]">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-gray-700">N°</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700">Hora</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700">Mesa</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700">Mesero</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700">Método Pago</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700 text-right">Total</th>
                                        <th className="px-6 py-4 font-semibold text-gray-700 text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sales.map(sale => (
                                        <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-gray-800">
                                                #{sale.daily_order_number || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(sale.updated_at).toLocaleTimeString()}
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                Mesa {sale.numero_mesa}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-medium">
                                                {profileMap[sale.garzon_id || '']?.split(' ')[0] || '---'}
                                            </td>
                                            <td className="px-6 py-4 capitalize">
                                                <span className={`
                            px-2 py-1 rounded-full text-xs font-bold
                            ${sale.metodo_pago === 'efectivo' ? 'bg-green-100 text-green-700' :
                                                        sale.metodo_pago === 'qr' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}
                          `}>
                                                    {sale.metodo_pago || 'Desconocido'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                Bs {sale.total.toFixed(2)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => setSelectedOrder(sale.id)}
                                                    className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                                    title="Ver Detalle"
                                                >
                                                    <Eye size={20} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {sales.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                                <Banknote className="mx-auto mb-2 opacity-50" size={32} />
                                                No se han registrado ventas hoy
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Detalle (Shared) */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-lg text-gray-900">
                                    Detalle de Venta
                                    {selectedOrderData?.daily_order_number && (
                                        <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">
                                            #{selectedOrderData.daily_order_number}
                                        </span>
                                    )}
                                </h3>
                                {selectedOrderData && (
                                    <p className="text-sm text-gray-500">
                                        Atendido por: <span className="font-medium text-gray-800">{profileMap[selectedOrderData.garzon_id || ''] || 'Desconocido'}</span>
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            {loadingDetails ? (
                                <div className="text-center py-8 text-gray-500">Cargando productos...</div>
                            ) : (
                                <table className="w-full text-sm">
                                    <thead className="text-gray-500 border-b">
                                        <tr>
                                            <th className="pb-2 text-left">Cant.</th>
                                            <th className="pb-2 text-left">Producto</th>
                                            <th className="pb-2 text-right">Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {orderItems.map(item => (
                                            <tr key={item.id}>
                                                <td className="py-3 font-medium w-12 text-center bg-gray-50 rounded-l">{item.cantidad}</td>
                                                <td className="py-3 pl-3">
                                                    <p className="font-medium text-gray-800">{item.products.nombre}</p>
                                                    {item.nota_especial && <p className="text-xs text-gray-500 italic">"{item.nota_especial}"</p>}
                                                </td>
                                                <td className="py-3 text-right font-medium text-gray-700">
                                                    Bs {(item.cantidad * item.precio_unitario).toFixed(2)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                            <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-bold">Total Venta</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    Bs {orderItems.reduce((sum, i) => sum + (i.cantidad * i.precio_unitario), 0).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

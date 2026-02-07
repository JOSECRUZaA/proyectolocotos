import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, CheckCircle, ChefHat, RefreshCcw, UtensilsCrossed, AlertCircle, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface OrderItem {
    id: string;
    cantidad: number;
    estado: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado';
    nota_especial?: string;
    products: {
        nombre: string;
    };
}

interface ActiveOrder {
    id: string;
    numero_mesa: number;
    created_at: string;
    total: number;
    estado: string;
    garzon_id?: string;
    mesas?: {
        estado: string;
    };
    order_items?: OrderItem[];
}

export default function WaiterOrders() {
    const { profile } = useAuth();
    const [orders, setOrders] = useState<ActiveOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!profile?.id) return;

        fetchOrders();

        const channel = supabase
            .channel('my_orders')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'orders', filter: `garzon_id=eq.${profile?.id}` },
                () => fetchOrders()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id]);

    async function fetchOrders() {
        if (!profile?.id) return;
        setLoading(true);
        setErrorMsg(null);

        try {
            const { data, error } = await supabase
                .from('orders')
                .select(`
                    id,
                    numero_mesa,
                    created_at,
                    total,
                    estado,
                    garzon_id,
                    mesas!fk_mesa (estado),
                    order_items (
                        id,
                        cantidad,
                        estado,
                        nota_especial,
                        products (nombre)
                    )
                `)
                .eq('garzon_id', profile.id)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            setOrders((data as any) || []);
        } catch (error: any) {
            console.error('Error fetching waiter orders:', error);
            setErrorMsg(error.message || "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pendiente': return <Clock size={16} className="text-gray-400" />;
            case 'en_preparacion': return <ChefHat size={16} className="text-orange-500 animate-pulse" />;
            case 'listo': return <CheckCircle size={16} className="text-green-500" />;
            case 'entregado': return <UtensilsCrossed size={16} className="text-blue-500" />;
            default: return <AlertCircle size={16} className="text-gray-300" />;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'pendiente': return 'En Espera';
            case 'en_preparacion': return 'Cocinando';
            case 'listo': return 'Listo para Servir';
            case 'entregado': return 'Entregado';
            default: return status;
        }
    };

    const printOrder = (order: ActiveOrder) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return alert("Por favor permite ventanas emergentes para imprimir");

        const itemsHtml = order.order_items?.map(item => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.cantidad} x ${item.products?.nombre}</span>
                <span></span>
            </div>
            ${item.nota_especial ? `<div style="font-size: 10px; margin-left: 10px; font-style: italic;">* ${item.nota_especial}</div>` : ''}
        `).join('') || '<div>Sin ítems</div>';

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Comanda - Mesa ${order.numero_mesa}</title>
                <style>
                    body {
                        font-family: 'Courier New', Courier, monospace;
                        width: 280px; /* Ancho aproximado para 58mm/80mm */
                        margin: 0;
                        padding: 10px;
                        font-size: 12px;
                    }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed black; padding-bottom: 5px; }
                    .footer { text-align: center; margin-top: 10px; border-top: 1px dashed black; padding-top: 5px; }
                    .bold { font-weight: bold; }
                    .big { font-size: 16px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="bold big">LOCOTOS RESTAURANTE</div>
                    <div>MESA: ${order.numero_mesa}</div>
                    <div>Garzón: ${profile?.email?.split('@')[0] || 'Desconocido'}</div>
                    <div>${format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</div>
                    <div class="bold">#ORDEN: ${String(order.id).slice(0, 8)}</div>
                </div>

                <div style="margin-bottom: 10px;">
                    ${itemsHtml}
                </div>

                <div class="footer">
                    <div class="big bold">TOTAL: Bs ${order.total}</div>
                    <div style="margin-top: 10px; font-style: italic;">
                         ${order.mesas?.estado === 'pidio_cuenta' ? '*** CLIENTE PIDE LA CUENTA ***' : 'Pre-Cuenta / Control Interno'}
                    </div>
                </div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    if (loading && orders.length === 0) return (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
        </div>
    );

    return (
        <div className="space-y-6 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Mis Pedidos de Hoy</h1>
                    <p className="text-gray-500 text-sm">Historial de órdenes generadas en tu turno</p>
                </div>
                <button
                    onClick={fetchOrders}
                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-600 transition-colors"
                >
                    <RefreshCcw size={20} />
                </button>
            </div>

            {errorMsg && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 text-red-700 text-sm mb-4">
                    Error: {errorMsg}
                </div>
            )}

            {orders.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="text-gray-400 font-medium">No se encontraron pedidos recientes.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                            {/* Header */}
                            <div className={`p-4 flex justify-between items-center border-b ${order.mesas?.estado === 'pidio_cuenta' ? 'bg-yellow-50 border-yellow-100' : 'bg-gray-50 border-gray-100'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-gray-900 text-white w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-lg">
                                        {order.numero_mesa}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Mesa</p>
                                        <p className="text-xs text-gray-500">
                                            {format(new Date(order.created_at), 'HH:mm', { locale: es })}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-lg text-gray-900">Bs {order.total}</p>
                                    <div className="flex justify-end items-center gap-2 mt-1">
                                        {order.mesas?.estado === 'pidio_cuenta' && (
                                            <span className="text-[10px] font-bold bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full animate-pulse">
                                                PIDIÓ CUENTA
                                            </span>
                                        )}
                                        <button
                                            onClick={() => printOrder(order)}
                                            className="p-2 bg-gray-200 hover:bg-gray-300 rounded-full text-gray-700 transition-colors shadow-sm active:scale-95"
                                            title="Imprimir Comanda"
                                        >
                                            <Printer size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Items List */}
                            <div className="p-4 space-y-3 flex-1">
                                {!order.order_items || order.order_items.length === 0 ? (
                                    <p className="text-center text-sm text-gray-400 italic">Sin ítems aún</p>
                                ) : (
                                    order.order_items.map((item, idx) => (
                                        <div key={item.id || idx} className="flex justify-between items-start text-sm">
                                            <div className="flex gap-2">
                                                <span className="font-bold text-gray-900 w-5">{item.cantidad}x</span>
                                                <div>
                                                    <span className="text-gray-700 block leading-tight">
                                                        {item.products?.nombre || 'Producto desconocido'}
                                                    </span>
                                                    {item.nota_especial && (
                                                        <span className="text-xs text-yellow-600 bg-yellow-50 px-1 rounded block w-fit mt-0.5">
                                                            "{item.nota_especial}"
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs uppercase font-bold tracking-wide ${item.estado === 'listo' ? 'bg-green-100 text-green-700' :
                                                item.estado === 'en_preparacion' ? 'bg-orange-100 text-orange-700' :
                                                    item.estado === 'entregado' ? 'bg-blue-50 text-blue-600' :
                                                        'bg-gray-100 text-gray-500'
                                                }`}>
                                                {getStatusIcon(item.estado)}
                                                {getStatusText(item.estado)}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer Actions */}
                            <div className="bg-gray-50 p-3 border-t text-xs text-center text-gray-400 font-medium flex justify-between">
                                <span>Orden ID: {String(order.id).slice(0, 8)}...</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

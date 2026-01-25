import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { ArrowLeft, CreditCard, Banknote, QrCode, Receipt, Lock, ChefHat, Beer, CheckCircle, BellRing } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { WaiterCallModal } from '../../components/WaiterCallModal';

type Order = Database['public']['Tables']['orders']['Row'];
type OrderItem = Database['public']['Tables']['order_items']['Row'] & {
    products: Database['public']['Tables']['products']['Row']
};

export default function OrderPayment() {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [order, setOrder] = useState<Order | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'tarjeta' | 'qr'>('efectivo');
    const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
    const [cashReceived, setCashReceived] = useState<string>('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);

    useEffect(() => {
        if (profile) {
            checkCashSession();
        }
    }, [profile]);

    useEffect(() => {
        if (tableId && hasActiveSession) {
            fetchOrderDetails();
        }
    }, [tableId, hasActiveSession]);

    // Check for active cash session
    async function checkCashSession() {
        if (!profile) return;
        const { data } = await supabase
            .from('cash_sessions')
            .select('id')
            .eq('cajero_id', profile.id)
            .eq('estado', 'abierta')
            .maybeSingle();

        setHasActiveSession(!!data);
        if (!data) setLoading(false);
    }

    // Suscripción Realtime
    useEffect(() => {
        if (!order) return;

        const channel = supabase
            .channel('order_payment_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'order_items',
                    filter: `order_id=eq.${order.id}`
                },
                () => {

                    fetchItemsOnly(order.id);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [order?.id]);

    const fetchOrderDetails = async () => {
        try {
            const { data: tableData, error: tableError } = await supabase
                .from('mesas')
                .select('orden_actual_id')
                .eq('numero_mesa', parseInt(tableId!))
                .single();

            if (tableError || !tableData?.orden_actual_id) {
                alert('No hay una orden activa para esta mesa.');
                navigate('/mesas');
                return;
            }

            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('id', tableData.orden_actual_id)
                .single();

            if (orderError) throw orderError;
            setOrder(orderData);

            await fetchItemsOnly(tableData.orden_actual_id);

        } catch (error: any) {
            console.error('Error fetching order:', error);
            alert('Error al cargar la orden: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchItemsOnly = async (orderId: number) => {
        const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('*, products(*)')
            .eq('order_id', orderId)
            .order('created_at');

        if (itemsError) console.error(itemsError);
        else setItems(itemsData as any);
    };

    const handlePayment = async () => {
        if (!order || !profile) return;
        setProcessing(true);

        try {
            const { error } = await supabase
                .from('orders')
                .update({
                    estado: 'pagado',
                    metodo_pago: paymentMethod,
                    cajero_id: profile.id
                })
                .eq('id', order.id);

            if (error) throw error;

            const { error: tableError } = await supabase
                .from('mesas')
                .update({
                    estado: 'libre',
                    orden_actual_id: null
                })
                .eq('numero_mesa', parseInt(tableId!));

            if (tableError) console.error('Error updating table status:', tableError);

            // Show Success Modal instead of generic alert
            setShowSuccessModal(true);

        } catch (error: any) {
            alert('Error al procesar pago: ' + error.message);
        } finally {
            setProcessing(false);
        }
    };

    // Calculate totals
    const calculateTotal = () => items.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    // Split Accounting
    const calculateKitchenTotal = () => items
        .filter(item => item.products.area === 'cocina')
        .reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    const calculateBarTotal = () => items
        .filter(item => item.products.area === 'bar')
        .reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);

    const pendingItemsCount = items.filter(i => ['pendiente', 'en_preparacion'].includes(i.estado)).length;
    const canPay = true; // VENTAS RÁPIDAS: Siempre permitido

    if (loading) return <div className="p-8 text-center">Cargando...</div>;

    if (hasActiveSession === false) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <div className="p-6 bg-red-100 rounded-full text-red-600 animate-pulse">
                    <Lock size={64} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Caja Cerrada</h1>
                    <p className="text-gray-600 mt-2 max-w-md mx-auto">
                        No puedes procesar cobros sin tener un turno de caja abierto.
                        Por favor, realiza la apertura de caja primero.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/caja')}
                    className="px-8 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg"
                >
                    Ir a Abrir Caja
                </button>
            </div>
        );
    }

    return (
        <div className="w-full space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/mesas')}
                        className="p-3 bg-white border border-gray-200 shadow-sm hover:shadow-md rounded-xl transition-all text-gray-600 hover:text-gray-900 group"
                        title="Volver al mapa"
                    >
                        <ArrowLeft size={24} className="group-hover:-translate-x-1 transition-transform" />
                    </button>
                    <div>
                        <h1 className="text-4xl font-black text-gray-800 tracking-tight">Mesa {tableId}</h1>
                        <div className="flex items-center gap-3 mt-1 text-gray-500 font-medium">
                            <span className="bg-gray-100 px-3 py-1 rounded-lg text-sm border border-gray-200">Orden #{order?.id}</span>
                            <div className="flex items-center gap-1 text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Cajero: {profile?.nombre_completo}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsWaiterModalOpen(true)}
                        className="ml-4 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-100 rounded-xl transition-all flex items-center gap-2 shadow-sm hover:shadow-md"
                        title="Llamar Garzón a esta mesa"
                    >
                        <BellRing size={20} className="fill-indigo-200" />
                        <span className="text-xs font-bold uppercase tracking-wide">Llamar Mesero</span>
                    </button>
                </div>

                <div className="flex items-center gap-6 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                    {/* Kitchen Breakdown */}
                    <div className="text-right hidden md:block opacity-60 hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-end gap-1">
                            <ChefHat size={14} /> Cocina
                        </p>
                        <p className="text-2xl font-black text-gray-800 leading-none">Bs {calculateKitchenTotal().toFixed(2)}</p>
                    </div>

                    {/* Bar Breakdown */}
                    <div className="text-right hidden md:block opacity-60 hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5 flex items-center justify-end gap-1">
                            <Beer size={14} /> Bar
                        </p>
                        <p className="text-2xl font-black text-gray-800 leading-none">Bs {calculateBarTotal().toFixed(2)}</p>
                    </div>

                    <div className="h-12 w-px bg-gray-100 hidden md:block"></div>

                    {/* Main Total */}
                    <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Total a Pagar</p>
                        <p className="text-4xl font-black text-red-600 leading-none tracking-tight">Bs {calculateTotal().toFixed(2)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

                {/* Left: Detailed Order View */}
                <div className="xl:col-span-8 flex flex-col gap-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1">
                        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <Receipt className="text-gray-400" /> Detalle de Consumo
                            </h2>
                            <span className="bg-gray-900 text-white font-bold px-4 py-1.5 rounded-full text-sm shadow-lg shadow-gray-200">
                                {items.length} items
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="py-4 px-6">Producto</th>
                                        <th className="py-4 px-6 text-center">Estado</th>
                                        <th className="py-4 px-6 text-center">Cant.</th>
                                        <th className="py-4 px-6 text-right">Precio</th>
                                        <th className="py-4 px-6 text-right">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map(item => {
                                        const isPending = ['pendiente', 'en_preparacion'].includes(item.estado);
                                        return (
                                            <tr key={item.id} className={`hover:bg-gray-50 transition-colors ${isPending ? 'bg-orange-50/30' : ''}`}>
                                                <td className="py-5 px-6">
                                                    <p className="font-bold text-gray-800 text-lg">{item.products.nombre}</p>
                                                    {item.nota_especial && (
                                                        <div className="flex items-center gap-1 mt-1 text-orange-600">
                                                            <div className="w-1 h-4 bg-orange-400 rounded-full"></div>
                                                            <span className="text-xs font-semibold">{item.nota_especial}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${item.estado === 'listo_para_servir' || item.estado === 'entregado'
                                                        ? 'bg-green-100 text-green-700 border-green-200'
                                                        : 'bg-orange-100 text-orange-700 border-orange-200'
                                                        }`}>
                                                        {item.estado.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6 text-center">
                                                    <span className="bg-gray-100 text-gray-800 font-bold px-3 py-1 rounded-lg">
                                                        {item.cantidad}
                                                    </span>
                                                </td>
                                                <td className="py-5 px-6 text-right text-gray-500 font-medium">
                                                    Bs {item.precio_unitario.toFixed(2)}
                                                </td>
                                                <td className="py-5 px-6 text-right font-bold text-gray-800 text-lg">
                                                    Bs {(item.cantidad * item.precio_unitario).toFixed(2)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right: Payment Controller */}
                <div className="xl:col-span-4 space-y-4">

                    {pendingItemsCount > 0 && (
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 relative overflow-hidden">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-full text-blue-600 shrink-0">
                                    <ChefHat size={20} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm leading-tight">Cobro Anticipado</h4>
                                    <p className="text-blue-800 text-xs mt-0.5">
                                        Esta orden tiene <strong>{pendingItemsCount} items</strong> en preparación.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`bg-white rounded-3xl shadow-xl border border-gray-100 p-5 sticky top-4`}>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Método de Pago</h3>

                        {/* Horizontal Grid for Payment Methods - Compact */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                                { id: 'efectivo', icon: Banknote, label: 'Efectivo', color: 'green' },
                                { id: 'tarjeta', icon: CreditCard, label: 'Tarjeta', color: 'blue' },
                                { id: 'qr', icon: QrCode, label: 'QR', color: 'purple' }
                            ].map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setPaymentMethod(method.id as any)}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all h-24 ${paymentMethod === method.id
                                        ? 'border-gray-800 bg-gray-50 shadow-inner'
                                        : 'border-gray-100 bg-white hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`p-2 rounded-full transition-colors ${paymentMethod === method.id ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'
                                        }`}>
                                        <method.icon size={20} />
                                    </div>
                                    <span className={`text-xs font-bold ${paymentMethod === method.id ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {method.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {/* CHANGE CALCULATOR - Compact */}
                        {paymentMethod === 'efectivo' && (
                            <div className="mb-4 pt-4 border-t border-dashed border-gray-200 animate-in fade-in slide-in-from-top-2">
                                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-wide">Monto Recibido</label>
                                <div className="relative mb-3 group">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">Bs</span>
                                    <input
                                        type="number"
                                        value={cashReceived}
                                        onChange={(e) => setCashReceived(e.target.value)}
                                        className="w-full pl-10 pr-3 py-2 text-2xl font-black rounded-lg border-2 border-gray-200 focus:border-gray-800 focus:ring-0 outline-none transition-all bg-gray-50 focus:bg-white"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>

                                <div className={`px-4 py-2 rounded-lg flex justify-between items-center transition-colors border-l-4 shadow-sm ${(parseFloat(cashReceived || '0') - calculateTotal()) >= 0
                                    ? 'bg-green-50 border-green-500 text-green-900'
                                    : 'bg-red-50 border-red-500 text-red-900'
                                    }`}>
                                    <span className="font-bold text-xs uppercase opacity-80">
                                        {(parseFloat(cashReceived || '0') - calculateTotal()) >= 0 ? 'Cambio' : 'Falta'}
                                    </span>
                                    <span className="text-xl font-black tracking-tight">
                                        <span className="text-xs align-top mr-0.5 opacity-50 font-bold">Bs</span>
                                        {Math.abs(parseFloat(cashReceived || '0') - calculateTotal()).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handlePayment}
                            disabled={processing || !canPay || (paymentMethod === 'efectivo' && parseFloat(cashReceived || '0') < calculateTotal())}
                            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-gray-200 hover:shadow-2xl hover:bg-black hover:-translate-y-0.5 active:translate-y-0 active:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none transition-all flex items-center justify-center gap-2"
                        >
                            {processing ? 'Procesando...' : (
                                <>
                                    <Receipt size={20} strokeWidth={2.5} /> Confirmar Pago
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* PREMIUM SUCCESS MODAL */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300 p-4">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm text-center transform transition-all scale-100 animate-in zoom-in-95 duration-500 relative overflow-hidden group">

                        {/* Decorative Background Pattern */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(circle at 10px 10px, #000 1px, transparent 0)', backgroundSize: '24px 24px' }}>
                        </div>

                        {/* Success Gradient Header */}
                        <div className="bg-gradient-to-br from-emerald-400 to-green-600 h-32 flex items-center justify-center relative overflow-hidden">
                            <div className="absolute inset-0 bg-white/10" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>

                            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg transform translate-y-8 animate-bounce-slow z-10">
                                <CheckCircle size={40} className="text-emerald-500" strokeWidth={4} />
                            </div>
                        </div>

                        <div className="pt-12 pb-8 px-8">
                            <h2 className="text-3xl font-black text-gray-800 mb-2 tracking-tight">¡Pago Exitoso!</h2>
                            <p className="text-gray-500 mb-8 font-medium leading-relaxed">
                                La transacción fue completada y la mesa ha sido liberada.
                            </p>

                            <button
                                onClick={() => navigate('/mesas')}
                                className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-gray-200 hover:shadow-2xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <ArrowLeft size={20} />
                                Volver al Mapa
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* WAITER CALL MODAL */}
            <WaiterCallModal
                isOpen={isWaiterModalOpen}
                onClose={() => setIsWaiterModalOpen(false)}
                mesaId={tableId ? parseInt(tableId) : undefined}
                senderRole="caja"
            />
        </div>
    );
}

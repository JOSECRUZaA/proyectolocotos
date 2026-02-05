import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    BarChart3, TrendingUp, Calendar, Users,
    DollarSign, ShoppingBag, Printer, Mail, X, List, AlertTriangle
} from 'lucide-react';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

interface DetailedOrder {
    id: string;
    date: Date;
    total: number;
    waiter: string;
    tableNumber?: number;
}

interface ReportMetrics {
    totalRevenue: number;
    totalOrders: number;
    averageTicket: number;
    totalOpening: number; // New: Opening amount
    totalCashSales: number; // New: Cash sales only
    topProducts: { name: string; quantity: number; revenue: number }[];
    lowProducts: { name: string; quantity: number; revenue: number }[];
    allProducts: { name: string; quantity: number; revenue: number }[];
    salesByWaiter: { name: string; total: number; orders: number }[];
    detailedOrders: DetailedOrder[];
}

type Period = 'today' | 'month' | 'year' | 'custom';

export default function ReportsDashboard() {
    const [period, setPeriod] = useState<Period>('today');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const [loading, setLoading] = useState(true);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [selectedWaiter, setSelectedWaiter] = useState<{ name: string; id: string } | null>(null);

    const [metrics, setMetrics] = useState<ReportMetrics>({
        totalRevenue: 0,
        totalOrders: 0,
        averageTicket: 0,
        totalOpening: 0,
        totalCashSales: 0,
        topProducts: [],
        lowProducts: [],
        allProducts: [],
        salesByWaiter: [],
        detailedOrders: []
    });

    useEffect(() => {
        fetchData();
    }, [period, customStart, customEnd]);

    const getDateRange = () => {
        const now = new Date();
        switch (period) {
            case 'today':
                return { start: startOfDay(now), end: endOfDay(now) };
            case 'month':
                return { start: startOfMonth(now), end: endOfMonth(now) };
            case 'year':
                return { start: startOfYear(now), end: endOfYear(now) };
            case 'custom':
                if (!customStart || !customEnd) return null;
                return {
                    start: startOfDay(new Date(customStart + 'T00:00:00')),
                    end: endOfDay(new Date(customEnd + 'T23:59:59'))
                };
        }
    };

    async function fetchData() {


        setLoading(true);
        const range = getDateRange();
        if (!range) {
            setLoading(false);
            return;
        }

        try {
            // 1. Fetch Orders in Range
            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id, total, garzon_id, created_at, numero_mesa, metodo_pago')
                .eq('estado', 'pagado')
                .gte('created_at', range.start.toISOString())
                .lte('created_at', range.end.toISOString())
                .order('created_at', { ascending: false });

            if (ordersError) throw ordersError;

            // 1b. Fetch Cash Sessions for Opening Amounts
            const { data: sessions, error: sessionsError } = await supabase
                .from('cash_sessions')
                .select('monto_apertura')
                .gte('opened_at', range.start.toISOString())
                .lte('opened_at', range.end.toISOString());

            if (sessionsError) throw sessionsError;

            // 2. Fetch Order Items in Range (for product stats)
            const orderIds = orders?.map(o => o.id) || [];

            interface ReportItem {
                quantity: number;
                price: number;
                products1: { nombre: string } | null;
            }

            let items: ReportItem[] = [];
            if (orderIds.length > 0) {
                const { data: itemsData, error: itemsError } = await supabase
                    .from('order_items')
                    .select('quantity:cantidad, price:precio_unitario, products1:products(nombre)')
                    .in('order_id', orderIds);

                if (itemsError) throw itemsError;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                items = (itemsData as any) || [];
            }

            // 3. Fetch Profiles for Waiter Names
            const waiterIds = [...new Set(orders?.map(o => o.garzon_id).filter(Boolean) as string[])];
            const waiterMap: Record<string, string> = {};

            if (waiterIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, nombre_completo')
                    .in('id', waiterIds);
                profiles?.forEach(p => waiterMap[p.id] = p.nombre_completo);
            }

            // --- CALCULATIONS ---

            const totalRevenue = orders?.reduce((sum, o) => sum + o.total, 0) || 0;
            const totalOrders = orders?.length || 0;
            const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

            // Cash specific
            const totalOpening = sessions?.reduce((sum, s) => sum + s.monto_apertura, 0) || 0;
            const totalCashSales = orders?.filter(o => o.metodo_pago?.toLowerCase() === 'efectivo').reduce((sum, o) => sum + o.total, 0) || 0;

            // Top Products
            const productStats: Record<string, { quantity: number; revenue: number }> = {};
            items.forEach((item) => {
                const name = item.products1?.nombre || 'Desconocido';
                if (!productStats[name]) productStats[name] = { quantity: 0, revenue: 0 };
                productStats[name].quantity += item.quantity;
                productStats[name].revenue += item.quantity * item.price;
            });

            const allProducts = Object.entries(productStats)
                .map(([name, stat]) => ({ name, ...stat }))
                .sort((a, b) => b.quantity - a.quantity);

            const topProducts = allProducts.slice(0, 5);
            const lowProducts = [...allProducts].reverse().slice(0, 5).filter(p => p.quantity > 0);

            // Waiter Performance
            const waiterStats: Record<string, { total: number; orders: number }> = {};
            orders?.forEach(o => {
                const name = waiterMap[o.garzon_id || ''] || 'Sin Asignar';
                if (!waiterStats[name]) waiterStats[name] = { total: 0, orders: 0 };
                waiterStats[name].total += o.total;
                waiterStats[name].orders += 1;
            });

            const salesByWaiter = Object.entries(waiterStats)
                .map(([name, stat]) => ({ name, ...stat }))
                .sort((a, b) => b.total - a.total);

            // Detailed Orders
            const detailedOrders: DetailedOrder[] = orders?.map(o => ({
                id: o.id.toString(),
                date: new Date(o.created_at),
                total: o.total,
                waiter: waiterMap[o.garzon_id || ''] || 'Sin Asignar',
                tableNumber: o.numero_mesa || undefined
            })) || [];

            setMetrics({
                totalRevenue,
                totalOrders,
                averageTicket,
                totalOpening,
                totalCashSales,
                topProducts,
                lowProducts,
                allProducts,
                salesByWaiter,
                detailedOrders
            });

        } catch (error) {
            console.error('Error report:', error);
        } finally {
            setLoading(false);
        }
    }


    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-20 print:p-0 print:pb-0">
            {/* PRINT STYLES */}
            <style>
                {`
                    @media print {
                        @page { margin: 1cm; size: auto; }
                        body { background: white; -webkit-print-color-adjust: exact; }
                        .no-print { display: none !important; }
                        .print-break { page-break-inside: avoid; }
                        
                        /* Fix Content Cutoff */
                        html, body, #root {
                            height: auto !important;
                            overflow: visible !important;
                            width: 100% !important;
                        }

                        /* Override Main Layout Constraints */
                        .h-screen { height: auto !important; }
                        aside, header { display: none !important; }
                        main {
                            height: auto !important;
                            overflow: visible !important;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            display: block !important;
                        }
                        
                        /* Kill all potential scrolls */
                        * { overflow: visible !important; }

                        /* Ensure Tables Expand */
                        table { width: 100% !important; table-layout: fixed; }
                        td, th { word-wrap: break-word; }
                        
                        /* Hide Shadows/Borders for Cleaner Print */
                        .shadow-sm, .shadow-md, .shadow-lg { box-shadow: none !important; }
                        .border { border: 1px solid #eee !important; }
                    }
                `}
            </style>

            {/* HEADER & CONTROLS */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Reportes Financieros</h1>
                    <p className="text-gray-500 mt-1">
                        Analítica avanzada de ventas y rendimiento.
                        <span className="hidden print:inline font-bold ml-2">
                            - Generado el: {new Date().toLocaleDateString()}
                        </span>
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 no-print">
                    <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-1">
                        {(['today', 'month', 'year', 'custom'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${period === p
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {p === 'today' && 'Hoy'}
                                {p === 'month' && 'Este Mes'}
                                {p === 'year' && 'Anual'}
                                {p === 'custom' && 'Personalizado'}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold hover:bg-gray-50 flex items-center gap-2 shadow-sm"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Imprimir</span>
                    </button>

                    <button
                        onClick={() => setShowEmailModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-md shadow-blue-200"
                    >
                        <Mail size={18} />
                        <span className="hidden sm:inline">Enviar</span>
                    </button>
                </div>
            </div>

            {/* CUSTOM DATE PICKER */}
            {period === 'custom' && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-end gap-4 animate-in slide-in-from-top-2 no-print">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Desde</label>
                        <input
                            type="date"
                            value={customStart}
                            onChange={(e) => setCustomStart(e.target.value)}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Hasta</label>
                        <input
                            type="date"
                            value={customEnd}
                            onChange={(e) => setCustomEnd(e.target.value)}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                        />
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                    >
                        <Calendar size={18} /> Aplicar Filtro
                    </button>
                </div>
            )}

            {loading ? (
                <div className="py-20 text-center">
                    <div className="animate-spin w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-400 font-medium">Calculando métricas...</p>
                </div>
            ) : (
                <>
                    {/* KPI CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group print:border-gray-300 print:shadow-none">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity no-print">
                                <DollarSign size={80} className="text-green-600 transform rotate-12" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Ventas Totales</p>
                                <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                                    Bs {metrics.totalRevenue.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                </h2>
                                <p className="text-green-600 text-sm font-bold mt-2 flex items-center gap-1">
                                    <TrendingUp size={14} /> Ingresos Netos
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group print:border-gray-300 print:shadow-none">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity no-print">
                                <ShoppingBag size={80} className="text-blue-600 transform -rotate-12" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Pedidos Cerrados</p>
                                <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                                    {metrics.totalOrders}
                                </h2>
                                <p className="text-blue-600 text-sm font-bold mt-2 flex items-center gap-1">
                                    <Calendar size={14} /> En este periodo
                                </p>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group print:border-gray-300 print:shadow-none">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity no-print">
                                <Users size={80} className="text-purple-600 transform rotate-6" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Ticket Promedio</p>
                                <h2 className="text-4xl font-black text-gray-900 tracking-tight">
                                    Bs {metrics.averageTicket.toLocaleString('es-BO', { maximumFractionDigits: 0 })}
                                </h2>
                                <p className="text-purple-600 text-sm font-bold mt-2 flex items-center gap-1">
                                    <BarChart3 size={14} /> Por Pedido
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CASH MANAGEMENT CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 print:grid-cols-3">
                        {/* OPENING AMOUNT */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group print:border-gray-300 print:shadow-none">
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Fondo de Apertura</p>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                                    Bs {metrics.totalOpening.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                </h2>
                                <p className="text-gray-400 text-sm font-bold mt-2">
                                    Monto inicial en caja
                                </p>
                            </div>
                        </div>

                        {/* CASH SALES */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group print:border-gray-300 print:shadow-none">
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Ventas en Efectivo</p>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight">
                                    Bs {metrics.totalCashSales.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                </h2>
                                <p className="text-green-600 text-sm font-bold mt-2">
                                    Generado por ventas
                                </p>
                            </div>
                        </div>

                        {/* TOTAL CASH */}
                        <div className="bg-gray-900 p-6 rounded-2xl shadow-lg border border-gray-900 relative overflow-hidden group text-white print:bg-white print:text-black print:border-gray-300">
                            <div className="relative z-10">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total en Caja</p>
                                <h2 className="text-3xl font-black text-white tracking-tight print:text-black">
                                    Bs {(metrics.totalOpening + metrics.totalCashSales).toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                </h2>
                                <p className="text-gray-400 text-sm font-bold mt-2">
                                    (Apertura + Ventas Efec.)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* CHARTS / TABLES */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-2 print:gap-4">
                        {/* TOP PRODUCTS */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col print:shadow-none print:border-gray-300 print-break">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <TrendingUp size={20} className="text-gray-400" /> Top 5 Productos
                                </h3>
                            </div>
                            <div className="p-2">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold print:bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Producto</th>
                                            <th className="px-4 py-3 text-right">Cant.</th>
                                            <th className="px-4 py-3 rounded-r-lg text-right">Ingresos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {metrics.topProducts.map((p, i) => (
                                            <tr key={i} className="hover:bg-gray-50 group">
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    <span className="text-gray-400 font-bold mr-2 text-xs">#{i + 1}</span>
                                                    {p.name}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600 font-mono">{p.quantity}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                    Bs {p.revenue.toLocaleString('es-BO')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* LOW PRODUCTS */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col print:shadow-none print:border-gray-300 print-break">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50">
                                <h3 className="font-bold text-lg text-red-800 flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-red-500" /> Menor Rotación
                                </h3>
                            </div>
                            <div className="p-2">
                                <table className="w-full text-left">
                                    <thead className="bg-red-50/50 text-xs text-red-400 uppercase font-bold print:bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3 rounded-l-lg">Producto</th>
                                            <th className="px-4 py-3 text-right">Cant.</th>
                                            <th className="px-4 py-3 rounded-r-lg text-right">Ingresos</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-50">
                                        {metrics.lowProducts.map((p, i) => (
                                            <tr key={i} className="hover:bg-red-50/30 group">
                                                <td className="px-4 py-3 font-medium text-gray-800">
                                                    {p.name}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-600 font-mono">{p.quantity}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                    Bs {p.revenue.toLocaleString('es-BO')}
                                                </td>
                                            </tr>
                                        ))}
                                        {metrics.lowProducts.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                                                    Datos insuficientes
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* WAITER PERFORMANCE */}
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col print:shadow-none print:border-gray-300 print-break">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <Users size={20} className="text-gray-400" /> Rendimiento Meseros
                                </h3>
                                <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-lg animate-pulse no-print">
                                    Click para ver detalle
                                </span>
                            </div>
                            <div className="p-6 space-y-4">
                                {metrics.salesByWaiter.map((w, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => {
                                            console.log('Clicked waiter:', w.name);
                                            setSelectedWaiter({ name: w.name, id: w.name });
                                        }}
                                        className="w-full text-left group transition-all hover:bg-gray-50 p-2 -mx-2 rounded-xl"
                                    >
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${i === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600 group-hover:bg-white transition-colors print:bg-gray-200 print:text-black'}`}>
                                                    {i + 1}
                                                </div>
                                                <span className="group-hover:text-blue-600 transition-colors">{w.name}</span>
                                            </span>
                                            <span className="text-xs font-bold text-gray-900">
                                                Bs {w.total.toLocaleString('es-BO')} <span className="text-gray-400 font-normal">({w.orders} pedidos)</span>
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden print:border print:border-gray-300">
                                            <div
                                                className={`h-full rounded-full ${i === 0 ? 'bg-yellow-400' : 'bg-blue-500'} print:bg-black group-hover:bg-blue-600 transition-colors`}
                                                style={{ width: `${(w.total / metrics.totalRevenue) * 100}%` }}
                                            ></div>
                                        </div>
                                    </button>
                                ))}
                                {metrics.salesByWaiter.length === 0 && (
                                    <p className="text-center text-gray-400 text-sm py-4">No hay datos de meseros en este periodo.</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ALL PRODUCTS TABLE */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col print:shadow-none print:border-gray-300 print-break">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <ShoppingBag size={20} className="text-gray-400" /> Detalle de Productos Vendidos
                            </h3>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold print:bg-gray-100">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">Producto</th>
                                        <th className="px-4 py-3 text-right">Cantidad</th>
                                        <th className="px-4 py-3 rounded-r-lg text-right">Total Generado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {metrics.allProducts.map((p, i) => (
                                        <tr key={i} className="hover:bg-gray-50 group">
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {p.name}
                                            </td>
                                            <td className="px-4 py-3 text-right text-gray-600 font-mono">{p.quantity}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                Bs {p.revenue.toLocaleString('es-BO')}
                                            </td>
                                        </tr>
                                    ))}
                                    {metrics.allProducts.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-6 text-center text-gray-400 text-sm">
                                                No hay productos vendidos en este periodo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* DETAILED TRANSACTIONS */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col print:shadow-none print:border-gray-300 print-break">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <List size={20} className="text-gray-400" /> Detalle de Transacciones
                            </h3>
                        </div>
                        <div className="p-2 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold print:bg-gray-100 print-table-header">
                                    <tr>
                                        <th className="px-4 py-3 rounded-l-lg">ID Pedido</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Mesa</th>
                                        <th className="px-4 py-3">Mesero</th>
                                        <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {metrics.detailedOrders.map((order) => (
                                        <tr key={order.id} className="hover:bg-gray-50 group">
                                            <td className="px-4 py-3 font-medium text-gray-800">{order.id}</td>
                                            <td className="px-4 py-3 text-gray-600">{order.date.toLocaleDateString()}</td>
                                            <td className="px-4 py-3 text-gray-600">{order.tableNumber || 'N/A'}</td>
                                            <td className="px-4 py-3 text-gray-600">{order.waiter}</td>
                                            <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                Bs {order.total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                    {metrics.detailedOrders.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">
                                                No hay transacciones detalladas para este periodo.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            <EmailModal
                isOpen={showEmailModal}
                onClose={() => setShowEmailModal(false)}
                metrics={metrics}
            />

            <WaiterDetailModal
                isOpen={!!selectedWaiter}
                onClose={() => setSelectedWaiter(null)}
                waiterName={selectedWaiter?.name || ''}
                orders={metrics.detailedOrders.filter(o => o.waiter === selectedWaiter?.name)}
            />
        </div>
    );
}

function EmailModal({ isOpen, onClose, metrics }: { isOpen: boolean; onClose: () => void; metrics: ReportMetrics }) {
    const [email, setEmail] = useState('');
    const [sending, setSending] = useState(false);

    if (!isOpen) return null;

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        setSending(true);

        // Construct email body
        const body = `
REPORTE FINANCIERO - WENDY RESTAURANTE
----------------------------------------
Ventas Totales: Bs ${metrics.totalRevenue.toLocaleString('es-BO')}
Pedidos Cerrados: ${metrics.totalOrders}
Ticket Promedio: Bs ${metrics.averageTicket.toLocaleString('es-BO')}

TOP PRODUCTOS:
${metrics.topProducts.map((p, i) => `${i + 1}. ${p.name} - ${p.quantity} un. (Bs ${p.revenue})`).join('\n')}

DETALLE DE PRODUCTOS VENDIDOS:
${metrics.allProducts.map(p => `- ${p.name}: ${p.quantity} un. (Bs ${p.revenue})`).join('\n')}

RENDIMIENTO MESEROS:
${metrics.salesByWaiter.map(w => `- ${w.name}: Bs ${w.total} (${w.orders} pedidos)`).join('\n')}

DETALLE DE TRANSACCIONES:
${metrics.detailedOrders.map(o => `- ID: ${o.id}, Fecha: ${o.date.toLocaleDateString()}, Mesa: ${o.tableNumber || 'N/A'}, Mesero: ${o.waiter}, Total: Bs ${o.total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}`).join('\n')}
----------------------------------------
Generado el: ${new Date().toLocaleString()}
`.trim();

        const subject = `Reporte Financiero ${new Date().toLocaleDateString()}`;
        const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        window.location.href = mailtoLink;

        setSending(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] no-print">
            <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Mail size={24} className="text-blue-600" />
                        Enviar Reporte
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100">
                        <X size={24} />
                    </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                    Se enviará un resumen PDF del reporte actual al destinatario.
                </p>

                <form onSubmit={handleSend} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            required
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="admin@wendys.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={sending}
                            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {sending ? 'Enviando...' : (
                                <>
                                    <Mail size={18} /> Enviar Ahora
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function WaiterDetailModal({ isOpen, onClose, waiterName, orders }: { isOpen: boolean; onClose: () => void; waiterName: string; orders: DetailedOrder[] }) {
    if (!isOpen) return null;

    const totalSales = orders.reduce((sum, o) => sum + o.total, 0);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100] no-print">
            <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 border-b pb-4 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Users size={24} className="text-blue-600" />
                            Detalle: {waiterName}
                        </h2>
                        <p className="text-sm text-gray-500">
                            Total Ventas: <span className="font-bold text-gray-900">Bs {totalSales.toLocaleString('es-BO', { minimumFractionDigits: 2 })}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100">
                        <X size={24} />
                    </button>
                </div>

                <div className="overflow-y-auto p-1">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold sticky top-0">
                            <tr>
                                <th className="px-4 py-3 rounded-l-lg">ID Pedido</th>
                                <th className="px-4 py-3">Hora</th>
                                <th className="px-4 py-3">Mesa</th>
                                <th className="px-4 py-3 text-right rounded-r-lg">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {orders.map((order) => (
                                <tr key={order.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-800">{order.id}</td>
                                    <td className="px-4 py-3 text-gray-600">{order.date.toLocaleTimeString()}</td>
                                    <td className="px-4 py-3 text-gray-600">Mesa {order.tableNumber || '?'}</td>
                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                        Bs {order.total.toLocaleString('es-BO', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                                        No hay pedidos registrados para este mesero en el periodo seleccionado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 pt-4 border-t flex justify-end shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-lg transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}

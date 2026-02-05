import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Wallet,
    Search,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle
} from 'lucide-react';

interface CashSessionWithProfile {
    id: number;
    cajero_id: string;
    monto_apertura: number;
    monto_cierre?: number;
    monto_sistema?: number;
    diferencia?: number;
    estado: 'abierta' | 'cerrada';
    opened_at: string;
    closed_at?: string;
    cajero: {
        nombre_completo: string;
        email?: string;
    };
}

export default function ActiveSessions() {
    const [sessions, setSessions] = useState<CashSessionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'abierta' | 'cerrada'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchSessions();

        // Subscribe to changes
        const channel = supabase
            .channel('admin_cash_monitor')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'cash_sessions' },
                () => fetchSessions()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cash_sessions')
                .select(`
                    *,
                    cajero:profiles(nombre_completo, email)
                `)
                .order('opened_at', { ascending: false });

            if (error) throw error;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSessions(data as any || []);
        } catch (err) {
            console.error('Error fetching sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    const filteredSessions = sessions.filter(session => {
        const matchesFilter = filter === 'all' || session.estado === filter;
        const matchesSearch = session.cajero?.nombre_completo.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const activeCount = sessions.filter(s => s.estado === 'abierta').length;

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Wallet className="text-gray-900" size={32} />
                        Monitor de Cajas
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">
                        Supervisión en tiempo real de turnos y arqueos.
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-gray-200 shadow-sm">
                    <div className="px-4 py-2 bg-green-50 text-green-700 rounded-lg font-bold text-sm flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        {activeCount} Cajas Activas
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por cajero..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                    />
                </div>

                <div className="flex gap-2 p-1 bg-white border border-gray-200 rounded-xl w-fit">
                    {(['all', 'abierta', 'cerrada'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filter === f
                                ? 'bg-gray-900 text-white shadow-md'
                                : 'text-gray-500 hover:bg-gray-50'
                                }`}
                        >
                            {f === 'all' ? 'Todas' : f}
                        </button>
                    ))}
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin h-10 w-10 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredSessions.map((session) => (
                        <div
                            key={session.id}
                            className={`bg-white rounded-2xl p-6 border transition-all hover:shadow-md ${session.estado === 'abierta'
                                ? 'border-green-200 shadow-green-50'
                                : 'border-gray-200'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                {/* User Info */}
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${session.estado === 'abierta' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {session.cajero?.nombre_completo.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900">{session.cajero?.nombre_completo}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 ${session.estado === 'abierta'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {session.estado === 'abierta' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                {session.estado}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock size={12} />
                                                Inicio: {new Date(session.opened_at).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Financials */}
                                <div className="flex flex-wrap items-center gap-8">
                                    <div>
                                        <p className="text-xs font-bold text-gray-400 uppercase">Apertura</p>
                                        <p className="text-xl font-bold text-gray-900">Bs {session.monto_apertura.toFixed(2)}</p>
                                    </div>

                                    {session.estado === 'cerrada' && (
                                        <>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Cierre Sistema</p>
                                                <p className="text-xl font-bold text-gray-600">Bs {session.monto_sistema?.toFixed(2)}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-gray-400 uppercase">Real Declarado</p>
                                                <p className="text-xl font-bold text-gray-900">Bs {session.monto_cierre?.toFixed(2)}</p>
                                            </div>
                                            <div className={`pl-4 border-l-2 ${(session.diferencia || 0) === 0 ? 'border-green-200' : 'border-red-200'
                                                }`}>
                                                <p className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                                                    {(session.diferencia || 0) !== 0 && <AlertTriangle size={12} className="text-orange-500" />}
                                                    Diferencia
                                                </p>
                                                <p className={`text-xl font-black ${(session.diferencia || 0) === 0
                                                    ? 'text-green-600'
                                                    : (session.diferencia || 0) > 0
                                                        ? 'text-blue-600'
                                                        : 'text-red-600'
                                                    }`}>
                                                    {(session.diferencia || 0) > 0 ? '+' : ''}{(session.diferencia || 0).toFixed(2)}
                                                </p>
                                            </div>
                                        </>
                                    )}

                                    {session.estado === 'abierta' && (
                                        <div className="bg-green-50 px-4 py-2 rounded-xl">
                                            <p className="text-xs font-bold text-green-600 uppercase">En Curso</p>
                                            <p className="text-sm font-medium text-green-800">Esperando cierre...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {filteredSessions.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
                            <p className="text-gray-400 font-medium">No se encontraron sesiones de caja.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

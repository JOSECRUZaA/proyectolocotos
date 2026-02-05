import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
    Briefcase,
    Search,
    Clock,
    CheckCircle,
    XCircle,
    User
} from 'lucide-react';

interface WorkSessionWithProfile {
    id: number;
    user_id: string;
    rol: string;
    started_at: string;
    ended_at?: string;
    status: 'activo' | 'finalizado';
    profiles: {
        nombre_completo: string;
        rol: string; // Current role in profile
    };
    duration?: string;
}

export default function StaffMonitor() {
    const [sessions, setSessions] = useState<WorkSessionWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'activo' | 'finalizado'>('activo'); // Default to active
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchSessions();

        // Realtime subscription
        const channel = supabase
            .channel('staff_monitor')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'work_sessions' },
                () => fetchSessions()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Timer for duration updates
    useEffect(() => {
        const interval = setInterval(() => {
            setSessions(prev => [...prev]); // Force re-render to update durations
        }, 60000);
        return () => clearInterval(interval);
    }, []);

    async function fetchSessions() {
        try {
            const { data, error } = await supabase
                .from('work_sessions')
                .select(`
                    *,
                    profiles (
                        nombre_completo,
                        rol
                    )
                `)
                .order('started_at', { ascending: false })
                .limit(50); // Last 50 sessions

            if (error) throw error;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setSessions(data as any);
        } catch (error) {
            console.error('Error fetching work sessions:', error);
        } finally {
            setLoading(false);
        }
    }

    const filteredSessions = sessions.filter(session => {
        const matchesFilter = filter === 'all' || session.status === filter;
        const matchesSearch = session.profiles?.nombre_completo.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    const activeCount = sessions.filter(s => s.status === 'activo').length;

    const getDuration = (start: string, end?: string) => {
        const startDate = new Date(start).getTime();
        const endDate = end ? new Date(end).getTime() : new Date().getTime();
        const diff = endDate - startDate;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Briefcase className="text-blue-600" />
                        Control de Personal
                    </h1>
                    <p className="text-gray-500">Monitorea los turnos activos e historial.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg border shadow-sm flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium uppercase">Personal Activo</span>
                            <span className="text-xl font-bold leading-none">{activeCount}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar empleado..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg border">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Todos
                    </button>
                    <button
                        onClick={() => setFilter('activo')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'activo' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Activos (En Turno)
                    </button>
                    <button
                        onClick={() => setFilter('finalizado')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filter === 'finalizado' ? 'bg-white text-gray-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Finalizados
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full py-12 flex justify-center text-gray-400">
                        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-blue-600 rounded-full"></div>
                    </div>
                ) : filteredSessions.length === 0 ? (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">
                        <User size={48} className="mb-4 opacity-50" />
                        <p>No hay turnos registrados con este filtro.</p>
                    </div>
                ) : (
                    filteredSessions.map(session => (
                        <div key={session.id} className="bg-white rounded-xl shadow-sm border overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${session.status === 'activo'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}>
                                            {session.profiles?.nombre_completo.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900">{session.profiles?.nombre_completo}</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">
                                                    {session.rol}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide flex items-center gap-1 ${session.status === 'activo'
                                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                        : 'bg-gray-50 text-gray-600 border border-gray-100'
                                        }`}>
                                        {session.status === 'activo' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                        {session.status}
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between items-center text-gray-600">
                                        <span className="flex items-center gap-2">
                                            <Clock size={16} className="text-gray-400" />
                                            Entrada
                                        </span>
                                        <span className="font-medium">
                                            {new Date(session.started_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </div>

                                    {session.ended_at && (
                                        <div className="flex justify-between items-center text-gray-600">
                                            <span className="flex items-center gap-2">
                                                <CheckCircle size={16} className="text-gray-400" />
                                                Salida
                                            </span>
                                            <span className="font-medium">
                                                {new Date(session.ended_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    )}

                                    <div className={`mt-3 pt-3 border-t flex justify-between items-center ${session.status === 'activo' ? 'text-blue-600' : 'text-gray-500'
                                        }`}>
                                        <span className="font-medium">Duración</span>
                                        <span className="font-bold font-mono">
                                            {getDuration(session.started_at, session.ended_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

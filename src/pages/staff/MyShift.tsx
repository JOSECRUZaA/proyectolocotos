import { useEffect, useState } from 'react';
import { useShift } from '../../contexts/ShiftContext';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, LogOut, Calendar, UserCheck, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

interface ShiftHistory {
    id: number;
    started_at: string;
    ended_at?: string;
    status: 'activo' | 'finalizado';
}

export default function MyShift() {
    const { currentSession, endShift, loading } = useShift();
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [history, setHistory] = useState<ShiftHistory[]>([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Fetch History
    useEffect(() => {
        async function fetchHistory() {
            if (!profile?.id) return;

            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { data } = await supabase
                .from('work_sessions')
                .select('id, started_at, ended_at, status')
                .eq('user_id', profile.id)
                .gte('started_at', startOfMonth.toISOString())
                .order('started_at', { ascending: false });

            if (data) {
                setHistory(data as ShiftHistory[]);
            }
        }
        fetchHistory();
    }, [profile?.id, currentSession]); // Refetch when shift changes

    const getDuration = (start: string, end?: string) => {
        const startDate = new Date(start).getTime();
        const endDate = end ? new Date(end).getTime() : currentTime.getTime();
        const diff = endDate - startDate;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours === 0) return `${minutes}m`;
        return `${hours}h ${minutes}m`;
    };

    const getDetailedDuration = () => {
        if (!currentSession?.started_at) return '00:00:00';
        const start = new Date(currentSession.started_at).getTime();
        const now = currentTime.getTime();
        const diff = now - start;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const handleEndShift = async () => {
        const confirm = window.confirm('¿Estás seguro de que deseas finalizar tu turno por hoy?');
        if (confirm) {
            await endShift();
            navigate('/');
        }
    };

    if (loading) return <div>Cargando asistencia...</div>;

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <UserCheck className="text-blue-600" size={32} />
                Mi Asistencia
            </h1>
            <p className="text-gray-500 mb-8">Gestión de turnos y reporte mensual.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* Status Card */}
                <div className="bg-white rounded-3xl p-8 shadow-md border border-gray-100 flex flex-col items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 w-full h-2 bg-gradient-to-r from-blue-500 to-cyan-400"></div>

                    <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center mb-6 relative">
                        {currentSession ? (
                            <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                        ) : null}
                        <Clock size={40} className="text-blue-600" />
                    </div>

                    <h2 className="text-gray-400 font-medium uppercase tracking-wider text-sm mb-1">Estado Actual</h2>
                    <p className={`text-2xl font-black mb-6 ${currentSession ? 'text-green-600' : 'text-gray-400'}`}>
                        {currentSession ? 'EN TURNO ACTIVO' : 'NO ESTÁS TRABAJANDO'}
                    </p>

                    {currentSession && (
                        <div className="space-y-2 mb-8">
                            <p className="text-6xl font-mono font-bold text-gray-800 tracking-tight">
                                {getDetailedDuration()}
                            </p>
                            <p className="text-gray-400 text-sm">Tiempo transcurrido</p>
                        </div>
                    )}

                    {!currentSession ? (
                        <div className="bg-gray-100 p-4 rounded-xl text-gray-500 text-sm">
                            Inicia tu turno desde el botón principal o bloque de la izquierda.
                        </div>
                    ) : (
                        <button
                            onClick={handleEndShift}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-200 transform hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={24} />
                            FINALIZAR JORNADA
                        </button>
                    )}
                </div>

                {/* Details Card */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200">
                    <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
                        <Calendar size={20} className="text-gray-400" />
                        Detalles de Hoy
                    </h3>

                    <div className="space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                                <UserCheck size={20} className="text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">Empleado</p>
                                <p className="font-bold text-gray-900">{profile?.nombre_completo}</p>
                                <p className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1 capitalize">
                                    {profile?.rol}
                                </p>
                            </div>
                        </div>

                        {currentSession && (
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <Clock size={20} className="text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500">Hora de Entrada</p>
                                    <p className="font-bold text-gray-900">
                                        {new Date(currentSession.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(currentSession.started_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* HISTORY SECTION */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b bg-gray-50 flex items-center gap-3">
                    <History className="text-gray-400" />
                    <h3 className="font-bold text-lg text-gray-800">Historial del Mes</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="p-4 border-b font-medium">Fecha</th>
                                <th className="p-4 border-b font-medium">Entrada</th>
                                <th className="p-4 border-b font-medium">Salida</th>
                                <th className="p-4 border-b font-medium text-right">Duración</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                        No hay registros este mes.
                                    </td>
                                </tr>
                            ) : (
                                history.map((session) => (
                                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-4 text-sm font-medium text-gray-900">
                                            {new Date(session.started_at).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {new Date(session.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {session.ended_at
                                                ? new Date(session.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded-full">EN CURSO</span>
                                            }
                                        </td>
                                        <td className="p-4 text-sm font-mono text-gray-900 text-right">
                                            {getDuration(session.started_at, session.ended_at)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

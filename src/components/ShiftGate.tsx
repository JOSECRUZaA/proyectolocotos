import { useShift } from '../contexts/ShiftContext';
import { useAuth } from '../contexts/AuthContext';
import { Play, Coffee, Clock } from 'lucide-react';

export default function ShiftGate({ children }: { children: React.ReactNode }) {
    const { currentSession, startShift, loading } = useShift();
    const { profile } = useAuth();

    // Allow admins to bypass shift check? 
    // For now, let's enforce it for everyone who uses this Gate, creating a "Work Mode".
    // Or maybe Admins just ignore it? 
    // Let's enforce it for consistency - data is good.

    // Exception: Admins on admin pages don't need this gate. 
    // This Gate is intended for /mesas, /cocina, /bar.

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-red-600 rounded-full"></div>
            </div>
        );
    }

    if (currentSession) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-orange-500/10 to-transparent pointer-events-none"></div>

            <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden transform transition-all hover:scale-[1.01] duration-300 relative z-10">

                {/* Header */}
                <div className="bg-gradient-to-br from-red-600 to-orange-600 p-10 text-center relative overflow-hidden">
                    {/* Decorative Circles */}
                    <div className="absolute top-[-20px] right-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute bottom-[-10px] left-[-10px] w-24 h-24 bg-black/10 rounded-full blur-xl"></div>

                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-inner ring-1 ring-white/30">
                            <Coffee size={36} className="text-white drop-shadow-md" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
                            Hola, {profile?.nombre_completo.split(' ')[0]}
                        </h1>
                        <p className="text-orange-50 font-medium text-lg opacity-90">¿Listo para comenzar?</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-8 space-y-8">
                    {/* Role Card */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm relative group">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-500 rounded-l-2xl"></div>
                        <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2 text-lg">
                            <Clock size={20} className="text-orange-500" />
                            <span className="capitalize">{profile?.rol}</span>
                        </h3>
                        <p className="text-gray-500 text-sm leading-relaxed">
                            Al marcar tu entrada, se activará tu cronómetro y tendrás acceso inmediato a tus herramientas de trabajo.
                        </p>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={startShift}
                        className="w-full group relative overflow-hidden bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl text-lg shadow-xl shadow-gray-200 transition-all active:scale-95"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-600 opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>
                        <div className="flex items-center justify-center gap-3 relative z-10">
                            <div className="bg-white/20 p-1.5 rounded-full">
                                <Play size={18} className="fill-white" />
                            </div>
                            <span>INICIAR TURNO</span>
                        </div>
                    </button>

                    <div className="text-center">
                        <p className="text-xs text-gray-300 font-medium tracking-widest uppercase">
                            Control de Asistencia Locotos
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

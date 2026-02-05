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
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="bg-red-600 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock size={120} className="text-white transform rotate-12" />
                    </div>
                    <div className="relative z-10">
                        <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl mx-auto flex items-center justify-center mb-6">
                            <Coffee size={40} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-black text-white mb-2">Hola, {profile?.nombre_completo.split(' ')[0]}</h1>
                        <p className="text-red-100 font-medium">¿Listo para comenzar tu turno?</p>
                    </div>
                </div>

                <div className="p-8">
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                Tu Rol: <span className="capitalize">{profile?.rol}</span>
                            </h3>
                            <p className="text-gray-500 text-sm">
                                Al iniciar turno, se registrará tu hora de entrada y podrás acceder a las funciones del sistema.
                            </p>
                        </div>

                        <button
                            onClick={startShift}
                            className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                        >
                            <Play size={24} className="fill-current" />
                            Marcar Entrada (Iniciar Turno)
                        </button>
                    </div>

                    <p className="text-center text-xs text-gray-400 mt-8">
                        Sistema de Control de Asistencia Wendy's
                    </p>
                </div>
            </div>
        </div>
    );
}

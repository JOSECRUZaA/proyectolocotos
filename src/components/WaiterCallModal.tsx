import { useState } from 'react';
import { useOnlineUsers } from '../contexts/OnlineUsersContext';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, User, BellRing } from 'lucide-react';
import { useToast } from './ui/Toast';

interface WaiterCallModalProps {
    isOpen: boolean;
    onClose: () => void;
    mesaId?: number; // Optional context
    senderRole: string; // 'caja', 'cocina', 'bar'
}

export function WaiterCallModal({ isOpen, onClose, mesaId, senderRole }: WaiterCallModalProps) {
    const { onlineUsers } = useOnlineUsers();
    const { profile } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Filter only waiters
    const waiters = onlineUsers.filter(u => u.rol === 'garzon');

    if (!isOpen) return null;

    const handleCallWaiter = async (waiterId: string, waiterName: string) => {
        if (!profile) return;
        setLoading(true);

        try {
            const { error } = await supabase
                .from('waiter_calls')
                .insert({
                    mesa_id: mesaId || null,
                    sender_role: senderRole,
                    sender_user_id: profile.id,
                    recipient_waiter_id: waiterId,
                    message: mesaId ? `Atención requerida en Mesa ${mesaId}` : 'Solicitud de presencia',
                    status: 'pending'
                });

            if (error) throw error;

            showToast(`🔔 Llamando a ${waiterName}...`, 'success');
            onClose();
        } catch (err: any) {
            showToast('Error al llamar: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                        <BellRing className="text-red-500" size={20} />
                        Llamar a Garzón
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    {mesaId && (
                        <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm font-medium text-center">
                            Solicitando atención para <strong>Mesa {mesaId}</strong>
                        </div>
                    )}

                    {waiters.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <User size={48} className="mx-auto mb-3 opacity-20" />
                            <p>No hay garzones conectados ahora mismo.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {waiters.map(waiter => (
                                <button
                                    key={waiter.id}
                                    onClick={() => handleCallWaiter(waiter.id, waiter.nombre_completo)}
                                    disabled={loading}
                                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-transparent bg-gray-50 hover:bg-red-50 hover:border-red-100 transition-all group text-left"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold group-hover:bg-red-100 group-hover:text-red-600">
                                        {waiter.nombre_completo.charAt(0)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900">{waiter.nombre_completo}</p>
                                        <p className="text-xs text-gray-500">Disponible</p>
                                    </div>
                                    <BellRing size={20} className="text-gray-300 group-hover:text-red-500" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Trash2, Plus, LayoutGrid, Users } from 'lucide-react';
import { useToast, Toast } from '../../components/ui/Toast';

interface Table {
    id: number;
    numero_mesa: number;
    capacidad: number;
    estado: 'libre' | 'ocupada' | 'pidio_cuenta';
}

export default function TableManagement() {
    const [tables, setTables] = useState<Table[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const { toast, showToast, hideToast } = useToast();

    // Form State
    const [formData, setFormData] = useState({
        numero_mesa: '',
        capacidad: ''
    });

    useEffect(() => {
        fetchTables();
    }, []);

    async function fetchTables() {
        try {
            const { data, error } = await supabase
                .from('mesas')
                .select('*')
                .order('numero_mesa');

            if (error) throw error;
            setTables(data || []);
        } catch (error) {
            console.error('Error loading tables:', error);
            showToast('Error al cargar mesas', 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('mesas')
                .insert([{
                    numero_mesa: parseInt(formData.numero_mesa),
                    capacidad: parseInt(formData.capacidad),
                    estado: 'libre'
                }]);

            if (error) throw error;

            setShowModal(false);
            setFormData({ numero_mesa: '', capacidad: '' });
            fetchTables();
            showToast('Mesa creada exitosamente', 'success');
        } catch (error: any) {
            showToast('Error al crear mesa: ' + error.message, 'error');
        }
    };

    const handleDelete = async (id: number, estado: string) => {
        if (estado !== 'libre') {
            showToast('No puedes eliminar una mesa OCUPADA. Ciérrala o cóbrala primero.', 'error');
            return;
        }

        if (!confirm('¿Estás seguro de eliminar esta mesa? Esta acción no se puede deshacer.')) return;

        try {
            const { error } = await supabase
                .from('mesas')
                .delete()
                .eq('id', id);

            if (error) throw error;
            fetchTables();
            showToast('Mesa eliminada correctamente', 'success');
        } catch (error: any) {
            showToast('Error al eliminar: ' + error.message, 'error');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Cargando gestión de mesas...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <LayoutGrid size={32} className="text-blue-600" />
                        Gestión de Mesas
                    </h1>
                    <p className="text-gray-500 mt-1">Configura la distribución de tu restaurante.</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
                >
                    <Plus size={20} />
                    Nueva Mesa
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tables.map((table) => (
                    <div key={table.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center group hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-gray-50 rounded-xl flex items-center justify-center text-xl font-black text-gray-700">
                                {table.numero_mesa}
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-wider mb-1">Capacidad</p>
                                <div className="flex items-center gap-2 text-gray-800 font-semibold">
                                    <Users size={16} className="text-gray-400" />
                                    {table.capacidad} Personas
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${table.estado === 'libre' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {table.estado}
                            </span>
                            <button
                                onClick={() => handleDelete(table.id, table.estado)}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar Mesa"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in-95">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">Nueva Mesa</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Número de Mesa</label>
                                <input
                                    type="number"
                                    required
                                    className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    placeholder="Ej: 1, 2, 15..."
                                    value={formData.numero_mesa}
                                    onChange={e => setFormData({ ...formData, numero_mesa: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Capacidad (Personas)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                                    placeholder="Ej: 4"
                                    value={formData.capacidad}
                                    onChange={e => setFormData({ ...formData, capacidad: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 text-gray-700 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all"
                                >
                                    Guardar Mesa
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <Toast
                message={toast.message}
                type={toast.type}
                isVisible={toast.isVisible}
                onClose={hideToast}
            />
        </div>
    );
}

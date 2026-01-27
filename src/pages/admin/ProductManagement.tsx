import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Plus, Edit2, Trash2, Search, X, RefreshCw, Star, Utensils } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';

type Product = Database['public']['Tables']['products']['Row'];
type ProductionArea = Product['area'];

interface ActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product | null;
    onSave: () => void;
}

function ProductModal({ isOpen, onClose, product, onSave }: ActionModalProps) {
    const [formData, setFormData] = useState<Partial<Product>>({
        nombre: '',
        descripcion: '',
        precio: 0,
        area: 'cocina',
        controla_stock: false,
        stock_actual: 0,
        stock_diario_base: 0,
        prioridad: false,
        disponible: true,
        foto_url: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (product) {
            setFormData(product);
        } else {
            setFormData({
                nombre: '',
                descripcion: '',
                precio: 0,
                area: 'cocina',
                controla_stock: false,
                stock_actual: 0,
                stock_diario_base: 0,
                prioridad: false,
                disponible: true,
                foto_url: ''
            });
        }
    }, [product, isOpen]);

    const { profile } = useAuth();
    const isCashier = profile?.rol === 'cajero';

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Sanitize payload: remove system fields that shouldn't be updated manually
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, created_at, ...updateData } = formData as any;

            let error;

            if (product?.id) {
                const { error: updateError } = await supabase
                    .from('products')
                    .update(updateData)
                    .eq('id', product.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('products')
                    .insert(updateData);
                error = insertError;
            }

            if (error) throw error;

            onSave();
            onClose();
        } catch (error: any) {
            console.error('Error saving:', error);
            alert('Error al guardar: ' + (error.message || 'Error desconocido'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold">{product ? 'Editar Producto' : 'Nuevo Producto'}</h2>
                    <button onClick={onClose}><X size={24} /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Nombre</label>
                        <input
                            className="w-full border rounded-lg p-2"
                            value={formData.nombre}
                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            required
                            disabled={isCashier}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Precio (Bs)</label>
                        <input
                            type="number"
                            step="0.50"
                            className="w-full border rounded-lg p-2"
                            value={formData.precio}
                            onChange={e => setFormData({ ...formData, precio: parseFloat(e.target.value) })}
                            required
                            disabled={isCashier}
                        />
                    </div>

                    {!isCashier && (
                        <div>
                            <label className="block text-sm font-medium mb-1">Imagen del Producto</label>

                            {/* Image Preview */}
                            {formData.foto_url && (
                                <div className="mb-3 relative group w-fit">
                                    <img src={formData.foto_url} alt="Vista previa" className="w-24 h-24 object-cover rounded-lg border" />
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, foto_url: '' })}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            )}

                            {/* File Input */}
                            <div className="flex gap-2 items-center">
                                <label className="flex-1 cursor-pointer">
                                    <span className="sr-only">Elegir archivo</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="block w-full text-sm text-gray-500
                                        file:mr-4 file:py-2 file:px-4
                                        file:rounded-full file:border-0
                                        file:text-sm file:font-semibold
                                        file:bg-red-50 file:text-red-700
                                        hover:file:bg-red-100"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;

                                            try {
                                                setLoading(true);
                                                // 1. Upload to Supabase Storage
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `${Math.random()}.${fileExt}`;
                                                const filePath = `${fileName}`;

                                                const { error: uploadError } = await supabase.storage
                                                    .from('products')
                                                    .upload(filePath, file);

                                                if (uploadError) throw uploadError;

                                                // 2. Get Public URL
                                                const { data } = supabase.storage
                                                    .from('products')
                                                    .getPublicUrl(filePath);

                                                setFormData({ ...formData, foto_url: data.publicUrl });
                                            } catch (error: any) {
                                                alert('Error al subir imagen: ' + error.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                    />
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Sube una imagen (JPG, PNG) desde tu dispositivo.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Área</label>
                            <select
                                className="w-full border rounded-lg p-2"
                                value={formData.area}
                                onChange={e => setFormData({ ...formData, area: e.target.value as ProductionArea })}
                                disabled={isCashier}
                            >
                                <option value="cocina">Cocina</option>
                                <option value="bar">Bar</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-2 mt-6">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.controla_stock}
                                    onChange={e => setFormData({ ...formData, controla_stock: e.target.checked })}
                                    className="w-4 h-4 text-red-600 rounded"
                                    disabled={isCashier}
                                />
                                <span className="text-sm font-medium">Controlar Stock</span>
                            </label>
                        </div>
                    </div>

                    {formData.controla_stock && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Stock Actual</label>
                                <input
                                    type="number"
                                    className="w-full border rounded-lg p-2"
                                    value={formData.stock_actual}
                                    onChange={e => setFormData({ ...formData, stock_actual: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                                    <RefreshCw size={14} /> Stock Base Diario
                                </label>
                                <input
                                    type="number"
                                    className="w-full border rounded-lg p-2"
                                    placeholder="Ej. 50"
                                    value={formData.stock_diario_base || 0}
                                    onChange={e => setFormData({ ...formData, stock_diario_base: parseInt(e.target.value) })}
                                />
                                <p className="text-[10px] text-gray-400 mt-1">Se reiniciará a este valor al "Iniciar Día"</p>
                            </div>
                        </div>
                    )}

                    <div className="mt-4 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={formData.prioridad || false}
                                onChange={e => setFormData({ ...formData, prioridad: e.target.checked })}
                                className="w-4 h-4 text-yellow-600 rounded"
                            />
                            <div className="flex items-center gap-2">
                                <Star size={18} className="text-yellow-500 fill-yellow-500" />
                                <div>
                                    <span className="text-sm font-bold text-gray-800">Producto Prioritario</span>
                                    <p className="text-xs text-gray-500">Aparecerá destacado en la toma de pedidos para impulsar su venta.</p>
                                </div>
                            </div>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Internal Component for Delete Confirmation
function DeleteConfirmationModal({ isOpen, onClose, onConfirm, loading }: { isOpen: boolean; onClose: () => void; onConfirm: () => void; loading: boolean }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl scale-100 transform transition-all">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className="bg-red-100 p-4 rounded-full text-red-600">
                        <Trash2 size={48} />
                    </div>

                    <div>
                        <h3 className="text-xl font-bold text-gray-900">¿Eliminar Producto?</h3>
                        <p className="text-gray-500 mt-2 text-sm">
                            El producto desaparecerá del menú y de la lista de gestión, pero
                            <span className="font-bold text-gray-700"> se mantendrá en el historial de ventas</span> para no afectar tus reportes.
                        </p>
                    </div>

                    <div className="flex gap-3 w-full mt-4">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? 'Eliminando...' : 'Sí, Eliminar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ProductManagement() {
    const { profile } = useAuth();
    const [products, setProducts] = useState<Product[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);

    // Delete Modal State
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState<number | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchProducts();
    }, []);

    async function fetchProducts() {
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('disponible', true) // Only show active products
            .order('nombre');
        setProducts(data || []);
    }

    const confirmDelete = async () => {
        if (productToDelete === null) return;
        setDeleteLoading(true);

        try {
            await supabase
                .from('products')
                .update({ disponible: false })
                .eq('id', productToDelete);

            fetchProducts();
            setDeleteModalOpen(false);
            setProductToDelete(null);
        } catch (error) {
            alert('Error al eliminar');
        } finally {
            setDeleteLoading(false);
        }
    };

    const startDayInventory = async () => {
        if (!confirm('¿Estás seguro de reiniciar el stock de los productos controlados?\n\nEl stock actual se reemplazará por el "Stock Base Diario" configurado.')) return;

        try {
            const { error } = await supabase.rpc('reset_daily_stock');
            if (error) throw error;
            alert('Inventario reiniciado correctamente');
            fetchProducts();
        } catch (error: any) {
            console.error('Error reset:', error);
            alert('Error: ' + error.message + '\n\n(Asegúrate de haber ejecutado el script SQL de actualización)');
        }
    };

    const handleDeleteClick = (id: number) => {
        setProductToDelete(id);
        setDeleteModalOpen(true);
    };

    const filteredProducts = products.filter(p =>
        p.nombre.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Productos</h1>
                <div className="flex gap-2">
                    <button
                        onClick={startDayInventory}
                        className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-50 font-medium"
                    >
                        <RefreshCw size={20} /> Iniciar Día
                    </button>
                    {profile?.rol !== 'cajero' && (
                        <button
                            onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 font-bold shadow-md shadow-red-200"
                        >
                            <Plus size={20} /> Nuevo Producto
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Reset Pagination on Search */}
                {(() => { useEffect(() => setCurrentPage(1), [search]); return null; })()}

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-700">Imagen</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Nombre</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Precio</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Área</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Orden y Stock</th>
                                <th className="px-6 py-3 font-semibold text-gray-700 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {/* PAGINATION LOGIC */}
                            {filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(product => (
                                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4">
                                        {product.foto_url ? (
                                            <img
                                                src={product.foto_url}
                                                alt={product.nombre}
                                                className="w-12 h-12 object-cover rounded-lg shadow-sm border border-gray-100"
                                                loading="lazy"
                                                decoding="async"
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs shadow-sm">
                                                <Utensils size={18} className="opacity-20" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-gray-900">{product.nombre}</td>
                                    <td className="px-6 py-4 font-bold text-gray-700">Bs {product.precio}</td>
                                    <td className="px-6 py-4 capitalize">
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.area === 'cocina' ? 'bg-orange-100 text-orange-700' :
                                            product.area === 'bar' ? 'bg-purple-100 text-purple-700' :
                                                'bg-gray-100 text-gray-700'
                                            }`}>
                                            {product.area}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            {product.controla_stock ? (
                                                <div className="flex flex-col">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold w-fit ${product.stock_actual > 5 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {product.stock_actual} unid.
                                                    </span>
                                                    {product.stock_diario_base ? (
                                                        <span className="text-[10px] text-gray-400">Base: {product.stock_diario_base}</span>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">Sin stock</span>
                                            )}

                                            {product.prioridad && (
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 w-fit">
                                                    <Star size={10} className="fill-yellow-500" />
                                                    PUSH
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="Editar / Prioridad"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            {profile?.rol !== 'cajero' && (
                                                <button
                                                    onClick={() => handleDeleteClick(product.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                        No se encontraron productos
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {filteredProducts.length > itemsPerPage && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
                        <span className="text-sm text-gray-500">
                            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredProducts.length)} a {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} productos
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Anterior
                            </button>
                            <span className="px-2 py-1 text-sm font-medium text-gray-700 self-center">
                                Pág. {currentPage}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredProducts.length / itemsPerPage), p + 1))}
                                disabled={currentPage * itemsPerPage >= filteredProducts.length}
                                className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <ProductModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                product={editingProduct}
                onSave={fetchProducts}
            />

            <DeleteConfirmationModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                loading={deleteLoading}
            />
        </div>
    );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database, TableStatus } from '../types/database.types';
import { Search, ShoppingCart, Trash2, Save, ArrowLeft, FileText, CheckCircle, Lock, ChefHat, Beer, ImageOff, UtensilsCrossed, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Product = Database['public']['Tables']['products']['Row'];

interface CartItem {
    internalId: string;
    product: Product;
    quantity: number;
    notes: string;
}

export default function OrderCreation() {
    const { tableId } = useParams();
    const navigate = useNavigate();
    const { profile } = useAuth();

    const [products, setProducts] = useState<Product[]>([]);
    const [category, setCategory] = useState<string>('all');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [tableStatus, setTableStatus] = useState<TableStatus | null>(null);
    const [requestingBill, setRequestingBill] = useState(false);

    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');

    // Mobile Cart State
    const [isCartOpen, setIsCartOpen] = useState(false);

    const TAG_SETS = {
        kitchen: [
            "Sin Sal", "Poco Cocido", "Bien Cocido", "Sin Cebolla", "Sin Picante", "Salsa Aparte"
        ],
        bar: [
            "Sin Hielo", "Poco Hielo", "Con Limón", "Sin Azúcar", "Tibio"
        ],
        global: [
            "Para Llevar", "⚠️ ALERGIA"
        ]
    };

    const openNoteModal = (item: CartItem) => {
        setEditingNote(item.internalId);
        setNoteText(item.notes || '');
    };

    const saveNote = () => {
        if (!editingNote) return;

        setCart(prev => {
            const currentItem = prev.find(i => i.internalId === editingNote);
            if (!currentItem) return prev;

            const updatedNote = noteText.trim();

            // 1. Check if there's ANOTHER item with the same product AND the SAME new note
            const duplicateItem = prev.find(i =>
                i.internalId !== editingNote &&
                i.product.id === currentItem.product.id &&
                (i.notes || '').trim() === updatedNote
            );

            if (duplicateItem) {
                // MERGE: Add current qty to duplicate, remove current
                return prev.map(i => {
                    if (i.internalId === duplicateItem.internalId) {
                        return { ...i, quantity: i.quantity + currentItem.quantity };
                    }
                    return i;
                }).filter(i => i.internalId !== editingNote);
            }

            // 2. No duplicate, just update the note
            return prev.map(item =>
                item.internalId === editingNote ? { ...item, notes: updatedNote } : item
            );
        });

        setEditingNote(null);
        setNoteText('');
    };

    const addTag = (tag: string) => {
        setNoteText(prev => {
            if (prev.includes(tag)) return prev;
            return prev ? `${prev}, ${tag}` : tag;
        });
    };

    useEffect(() => {
        // Strict Check: Ensure Cash Session is Open
        async function checkSession() {
            const { count } = await supabase
                .from('cash_sessions')
                .select('*', { count: 'exact', head: true })
                .eq('estado', 'abierta');

            if (count === 0) {
                alert('⛔ ACCESO DENEGADA\n\nNo hay ninguna Caja Abierta. No se pueden procesar pedidos.');
                navigate('/mesas');
            }
        }
        checkSession();
    }, []);

    useEffect(() => {
        fetchProducts();
        if (tableId) fetchTableStatus();
    }, [tableId]);

    async function fetchTableStatus() {

        const { data } = await supabase
            .from('mesas')
            .select('estado')
            .eq('numero_mesa', parseInt(tableId || '0'))
            .single();
        if (data) setTableStatus(data.estado);
    }

    async function fetchProducts() {
        const { data } = await supabase
            .from('products')
            .select('*')
            .eq('disponible', true)
            .order('nombre');
        setProducts(data || []);
    }

    const filteredProducts = products.filter(p => {
        const matchesCategory = category === 'all' || p.area === category;
        const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const addToCart = (product: Product) => {
        setCart(prev => {
            // Check if there is an item with this product AND empty notes
            const existing = prev.find(item => item.product.id === product.id && (!item.notes || item.notes === ''));

            if (existing) {
                return prev.map(item =>
                    item.internalId === existing.internalId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            // Create new item with unique internalId
            return [...prev, {
                internalId: crypto.randomUUID(),
                product,
                quantity: 1,
                notes: ''
            }];
        });
    };

    const removeFromCart = (internalId: string) => {
        setCart(prev => prev.filter(item => item.internalId !== internalId));
    };

    const updateQuantity = (internalId: string, delta: number) => {
        setCart(prev => prev.map(item => {
            if (item.internalId === internalId) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const submitOrder = async () => {
        if (!profile || cart.length === 0) return;
        setLoading(true);

        try {
            const { data: tableData } = await supabase
                .from('mesas')
                .select('orden_actual_id, estado')
                .eq('numero_mesa', parseInt(tableId!))
                .single();

            let orderId = tableData?.orden_actual_id;
            let orderError;

            if (!orderId) {
                const { data: order, error } = await supabase
                    .from('orders')
                    .insert({
                        numero_mesa: parseInt(tableId || '0'),
                        garzon_id: profile.id,
                        estado: 'pendiente',
                        total: cart.reduce((acc, item) => acc + (item.product.precio * item.quantity), 0)
                    })
                    .select()
                    .single();
                orderId = order?.id;
                orderError = error;
            } else {
                // Ideally update total here too
            }

            if (orderError || !orderId) throw orderError || new Error('No se pudo crear la orden');

            const items = cart.map(item => ({
                order_id: orderId!,
                product_id: item.product.id,
                cantidad: item.quantity,
                precio_unitario: item.product.precio,
                nota_especial: item.notes,
                estado: 'pendiente' as const
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(items);

            if (itemsError) throw itemsError;

            if (tableData?.estado === 'libre') {
                await supabase.from('mesas').update({ estado: 'ocupada', orden_actual_id: orderId }).eq('numero_mesa', parseInt(tableId!));
            }

            navigate('/mesas');
        } catch (error: any) {
            alert('Error al crear orden: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const requestBill = async () => {
        setRequestingBill(true);
        try {
            const { error } = await supabase
                .from('mesas')
                .update({ estado: 'pidio_cuenta' })
                .eq('numero_mesa', parseInt(tableId!));

            if (error) throw error;

            setTableStatus('pidio_cuenta');
            alert('Cuenta solicitada. La mesa parpadeará en la caja.');
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setRequestingBill(false);
        }
    };

    // BLOCKING UI FOR CASHIER (Role Restriction)
    if (profile?.rol === 'cajero') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6">
                <div className="p-6 bg-red-100 rounded-full text-red-600">
                    <Lock size={64} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Acceso Restringido</h1>
                    <p className="text-gray-600 mt-2 max-w-md mx-auto text-lg">
                        ⛔ <strong>Un Cajero NO puede tomar pedidos.</strong>
                    </p>
                    <p className="text-gray-500 mt-2">
                        Si un cliente desea ordenar, por favor solicite a un <strong>Mesero</strong> que atienda la mesa.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/mesas')}
                    className="px-8 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-900 transition-colors shadow-lg"
                >
                    Volver al Mapa
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row h-[calc(100vh-theme(spacing.20))] gap-6 relative">
            {/* NOTES MODAL OVERLAY */}
            {editingNote && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b bg-gray-50 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FileText size={20} className="text-red-500" />
                                Nota para Cocina/Bar
                            </h3>
                            <button onClick={() => setEditingNote(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <ArrowLeft size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Etiquetas Rápidas</label>
                                <div className="flex flex-wrap gap-2">
                                    {(() => {
                                        const currentProduct = cart.find(item => item.internalId === editingNote)?.product;
                                        const areaTags = currentProduct?.area === 'cocina' ? TAG_SETS.kitchen : TAG_SETS.bar;
                                        const relevantTags = [...(areaTags || []), ...TAG_SETS.global];

                                        return relevantTags.map(tag => (
                                            <button
                                                key={tag}
                                                onClick={() => addTag(tag)}
                                                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors border border-gray-200 active:scale-95"
                                            >
                                                {tag}
                                            </button>
                                        ));
                                    })()}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Instrucciones Específicas</label>
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder="Escribe aquí detalles adicionales..."
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none h-32 resize-none text-gray-700 font-medium"
                                    autoFocus
                                />
                            </div>

                            <button
                                onClick={saveNote}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={20} />
                                Guardar Nota
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Left: Product List */}
            <div className="flex-1 flex flex-col gap-4 w-full">
                {/* Header */}
                <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigate('/mesas')} className="p-2 hover:bg-gray-100 rounded-lg active:bg-gray-200 active:scale-95 transition-all">
                            <ArrowLeft />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold">Mesa {tableId}</h1>
                            <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold ${tableStatus === 'libre' ? 'bg-green-100 text-green-700' :
                                tableStatus === 'pidio_cuenta' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {tableStatus?.replace('_', ' ') || 'Cargando...'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
                        <button
                            onClick={() => setCategory('all')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all active:scale-95 ${category === 'all'
                                ? 'bg-gray-900 text-white shadow-lg shadow-gray-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <UtensilsCrossed size={18} />
                            Todos
                        </button>
                        <button
                            onClick={() => setCategory('cocina')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all active:scale-95 ${category === 'cocina'
                                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <ChefHat size={18} />
                            Cocina
                        </button>
                        <button
                            onClick={() => setCategory('bar')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all active:scale-95 ${category === 'bar'
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <Beer size={18} />
                            Bar
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar productos..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-4 min-h-0 content-start">
                    {filteredProducts.map(product => (
                        <button
                            key={product.id}
                            onClick={() => addToCart(product)}
                            className={`rounded-2xl border shadow-sm hover:shadow-xl hover:-translate-y-1 active:scale-95 active:shadow-inner transition-all overflow-hidden flex flex-col group h-auto min-h-[200px] relative w-full ${product.prioridad ? 'bg-yellow-50/30 border-yellow-400 ring-4 ring-yellow-50/50 shadow-yellow-100' : 'bg-white border-gray-100'
                                }`}
                        >
                            {/* Priority Badge */}
                            {product.prioridad && (
                                <div className="absolute top-3 right-3 z-30 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-pulse">
                                    <Star size={10} className="fill-yellow-900" />
                                    RECOMENDADO
                                </div>
                            )}
                            {/* Product Image Area - Robust Layout */}
                            <div className={`w-full h-32 shrink-0 flex items-center justify-center relative overflow-hidden ${product.area === 'cocina' ? 'bg-orange-50' : (product.area === 'bar' ? 'bg-purple-50' : 'bg-gray-50')
                                }`}>
                                {/* Fallback Icon (Always rendered behind as base layer) */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-30 z-0">
                                    {product.area === 'cocina' ? <ChefHat size={48} className="text-orange-500" /> :
                                        product.area === 'bar' ? <Beer size={48} className="text-purple-500" /> :
                                            <ImageOff size={48} className="text-gray-400" />}
                                </div>

                                {/* Image (Overlay) */}
                                {product.foto_url && (
                                    <img
                                        src={product.foto_url}
                                        alt={product.nombre}
                                        className="w-full h-full object-cover z-10 transition-transform duration-500 group-hover:scale-105"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none'; // Hide image, showing fallback
                                        }}
                                    />
                                )}

                                {/* Overlay Add Icon (Top Layer) */}
                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px] z-20">
                                    <div className="bg-white rounded-full p-2 text-gray-900 shadow-lg transform scale-0 group-hover:scale-100 transition-transform">
                                        <span className="font-bold text-xl">+</span>
                                    </div>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-4 flex flex-col flex-1 w-full text-left">
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${product.area === 'cocina' ? 'bg-orange-100 text-orange-700' :
                                        product.area === 'bar' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {product.area}
                                    </span>
                                    <span className="font-bold text-lg text-gray-900">Bs {product.precio}</span>
                                </div>

                                <h3 className="font-bold text-gray-800 leading-tight line-clamp-2 mb-1 group-hover:text-red-600 transition-colors">
                                    {product.nombre}
                                </h3>

                                {product.descripcion && (
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-auto">
                                        {product.descripcion}
                                    </p>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Mobile View Cart FAB */}
            <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
                <button
                    onClick={() => setIsCartOpen(true)}
                    className="w-full bg-gray-900 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center font-bold animate-in slide-in-from-bottom-4 active:scale-95 transition-transform"
                >
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 px-2 py-0.5 rounded text-sm font-mono">
                            {cart.reduce((acc, item) => acc + item.quantity, 0)}
                        </div>
                        <span>Ver Pedido</span>
                    </div>
                    <span>Bs {cart.reduce((acc, item) => acc + (item.product.precio * item.quantity), 0).toFixed(2)}</span>
                </button>
            </div>

            {/* Right: Cart (Desktop Sidebar / Mobile Modal) */}
            <>
                {/* Mobile Backdrop */}
                {isCartOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm animate-in fade-in"
                        onClick={() => setIsCartOpen(false)}
                    />
                )}

                <div className={`
                    fixed inset-y-0 right-0 z-50 w-full md:w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col
                    lg:relative lg:transform-none lg:w-96 lg:shadow-lg lg:border lg:border-gray-200 lg:rounded-2xl lg:h-full lg:z-auto
                    ${isCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
                `}>
                    <div className="p-4 border-b bg-gray-50 lg:rounded-t-2xl flex justify-between items-center shrink-0">
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <ShoppingCart size={20} />
                            Pedido Actual
                        </h2>
                        <button
                            onClick={() => setIsCartOpen(false)}
                            className="p-2 bg-gray-100 rounded-full text-gray-600 lg:hidden"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {cart.length === 0 ? (
                            <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                                <ShoppingCart size={40} className="mb-2 opacity-20" />
                                <p>Selecciona productos</p>

                                {/* Request Bill Button for Empty Cart */}
                                {tableStatus === 'ocupada' && (
                                    <div className="mt-8 w-full border-t pt-8">
                                        <button
                                            onClick={requestBill}
                                            disabled={requestingBill}
                                            className="w-full bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-yellow-300"
                                        >
                                            <FileText size={20} />
                                            {requestingBill ? 'Solicitando...' : 'Pedir Cuenta'}
                                        </button>
                                        <p className="text-xs text-center text-gray-400 mt-2">
                                            Envía una alerta al cajero para cobrar esta mesa.
                                        </p>
                                    </div>
                                )}

                                {tableStatus === 'pidio_cuenta' && (
                                    <div className="mt-8 w-full bg-green-50 p-4 rounded-lg border border-green-200">
                                        <p className="text-green-800 font-medium flex items-center justify-center gap-2">
                                            <CheckCircle size={18} />
                                            Cuenta Solicitada
                                        </p>
                                        <p className="text-xs text-center text-green-600 mt-1">El cajero ya ha sido notificado.</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            cart.map(item => (
                                <div key={item.internalId} className="flex flex-col gap-2 border-b pb-4 last:border-0 group">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-medium text-gray-900 leading-tight">{item.product.nombre}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-sm font-bold text-gray-500">Bs {item.product.precio * item.quantity}</p>
                                                {item.quantity > 1 && <span className="text-xs text-gray-400">({item.quantity} x {item.product.precio})</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.internalId)}
                                            className="text-gray-300 hover:text-red-500 p-1"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                            <button
                                                onClick={() => updateQuantity(item.internalId, -1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm hover:text-red-600 font-bold active:bg-gray-50"
                                            >
                                                -
                                            </button>
                                            <span className="font-bold w-10 text-center text-gray-800">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.internalId, 1)}
                                                className="w-8 h-8 flex items-center justify-center bg-white rounded shadow-sm hover:text-green-600 font-bold active:bg-gray-50"
                                            >
                                                +
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => openNoteModal(item)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-all ${item.notes
                                                ? 'bg-yellow-100 text-yellow-800 border border-yellow-200'
                                                : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'
                                                }`}
                                        >
                                            <FileText size={16} className={item.notes ? 'fill-yellow-500 text-yellow-600' : ''} />
                                            {item.notes ? 'Editar Nota' : 'Nota'}
                                        </button>
                                    </div>

                                    {item.notes && (
                                        <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100 text-xs text-yellow-800 flex items-start gap-1.5 mt-1">
                                            <div className="mt-0.5 min-w-[3px] h-[3px] rounded-full bg-yellow-500" />
                                            <p className="line-clamp-2 italic">{item.notes}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {cart.length > 0 && (
                        <div className="p-4 border-t bg-gray-50 lg:rounded-b-2xl space-y-4 pb-8 lg:pb-4 shrink-0">
                            <div className="flex justify-between items-center text-lg font-bold">
                                <span>Total</span>
                                <span>Bs {cart.reduce((acc, item) => acc + (item.product.precio * item.quantity), 0).toFixed(2)}</span>
                            </div>

                            <button
                                onClick={submitOrder}
                                disabled={cart.length === 0 || loading}
                                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-transform"
                            >
                                {loading ? 'Enviando...' : (
                                    <>
                                        <Save size={20} />
                                        Confirmar Pedido
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </>
        </div>
    );
}

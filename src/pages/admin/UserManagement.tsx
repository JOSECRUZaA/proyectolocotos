/* eslint-disable */
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Trash2, Search, UserPlus, X, Pencil, CheckCircle, KeyRound } from 'lucide-react';
import PromptModal from '../../components/ui/PromptModal';
import { Toast, useToast } from '../../components/ui/Toast';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface UserFormData {
    email: string;
    password?: string;
    nombre: string;
    carnet: string;
    rol: Database['public']['Tables']['profiles']['Row']['rol'];
}

export default function UserManagement() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Profile | null>(null);

    const [showInactive, setShowInactive] = useState(false);
    const { toast, showToast } = useToast();

    // Reset Password State
    const [isResetOpen, setIsResetOpen] = useState(false);
    const [resetTargetUser, setResetTargetUser] = useState<{ id: string; name: string } | null>(null);
    const [newPassword, setNewPassword] = useState('');

    // Delete Confirmation State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    async function fetchUsers() {
        const { data } = await supabase.from('profiles').select('*').order('nombre_completo');
        setUsers(data || []);
    }

    const openResetPassword = (userId: string, userName: string) => {
        setResetTargetUser({ id: userId, name: userName });
        setNewPassword('');
        setIsResetOpen(true);
    };

    const confirmResetPassword = async () => {
        if (!resetTargetUser || !newPassword) return;
        if (newPassword.length < 6) {
            showToast('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }

        const { error } = await supabase.rpc('admin_reset_password', {
            target_user_id: resetTargetUser.id,
            new_password: newPassword
        });

        if (error) {
            console.error('Error resetting password:', error);
            showToast('Error al resetear contraseña: ' + error.message, 'error');
        } else {
            showToast('Contraseña actualizada correctamente', 'success');
            setIsResetOpen(false);
            setResetTargetUser(null);
            setNewPassword('');
        }
    };

    const openDelete = (userId: string) => {
        setDeleteTargetId(userId);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteTargetId) return;

        const { error } = await supabase.rpc('delete_user_completely', { target_user_id: deleteTargetId });

        if (error) {
            console.error('Error deleting user:', error);
            showToast('Error al eliminar usuario: ' + error.message, 'error');
        } else {
            showToast('Usuario eliminado correctamente', 'success');
            fetchUsers();
            setIsDeleteOpen(false);
            setDeleteTargetId(null);
        }
    };

    const handleEditUser = (user: Profile) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleSaveUser = async (userData: UserFormData) => {
        if (editingUser) {
            // UPDATE EXISTING USER
            const { error } = await supabase
                .from('profiles')
                .update({
                    nombre_completo: userData.nombre,
                    carnet_identidad: userData.carnet,
                    rol: userData.rol
                })
                .eq('id', editingUser.id);

            if (error) {
                showToast('Error al actualizar usuario: ' + error.message, 'error');
            } else {
                showToast('Usuario actualizado correctamente', 'success');
                await fetchUsers();
                setIsModalOpen(false);
                setEditingUser(null);
            }
        } else {
            // CREATE NEW USER
            // Create a temporary client to avoid logging out the admin
            const tempSupabase = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                {
                    auth: {
                        persistSession: false,
                        autoRefreshToken: false,
                        detectSessionInUrl: false
                    }
                }
            );

            // STRICT CLEANING
            const userInput = userData.email.trim();
            const cleanEmail = userInput.includes('@')
                ? userInput.toLowerCase()
                : `${userInput.replace(/[^a-zA-Z0-9._-]/g, '').toUpperCase()}@locotos.system`;

            const cleanPassword = (userData.password || '').trim();

            const { data: signUpData, error } = await tempSupabase.auth.signUp({
                email: cleanEmail,
                password: cleanPassword,
                options: {
                    data: {
                        nombre: userData.nombre,
                        carnet: userData.carnet,
                        rol: userData.rol
                    }
                }
            });

            if (error) {
                showToast('Error al crear usuario: ' + error.message, 'error');
            } else if (signUpData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        nombre_completo: userData.nombre,
                        carnet_identidad: userData.carnet,
                        rol: userData.rol
                    })
                    .eq('id', signUpData.user.id);

                if (profileError) {
                    showToast('Error al guardar perfil', 'error');
                } else {
                    showToast('Usuario creado exitosamente', 'success');
                }

                setIsModalOpen(false);
                setTimeout(fetchUsers, 1000);
            }
        }
    };

    const filteredUsers = users.filter(u =>
        ((u.nombre_completo || '').toLowerCase().includes(search.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(search.toLowerCase())) &&
        (showInactive ? true : u.activo)
    );

    return (
        <div className="space-y-6">
            <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => { }} />

            <div className="flex justify-between items-center column-gap-4">
                <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>

                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                        />
                        Ver Archivados
                    </label>

                    <button
                        onClick={() => {
                            setEditingUser(null);
                            setIsModalOpen(true);
                        }}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 font-bold shadow-sm"
                    >
                        <UserPlus size={20} /> Nuevo Usuario
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar usuarios..."
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 font-semibold text-gray-700">Nombre</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Carnet</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Rol</th>
                                <th className="px-6 py-3 font-semibold text-gray-700">Estado</th>
                                <th className="px-6 py-3 font-semibold text-gray-700 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium">{user.nombre_completo || 'Sin Nombre'}</p>
                                            <p className="text-xs text-gray-400">{user.email || 'Sin Email'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{user.carnet_identidad}</td>
                                    <td className="px-6 py-4 capitalize">
                                        <span className={`px-2 py-1 rounded-full text-xs border ${user.rol === 'administrador' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                            user.rol === 'cajero' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                user.rol === 'cocina' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                                                    user.rol === 'bar' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                            }`}>
                                            {user.rol}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${user.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {user.activo ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                                        <button
                                            onClick={() => handleEditUser(user)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Editar usuario"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => openResetPassword(user.id, user.nombre_completo || 'Usuario')}
                                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                                            title="Cambiar Contraseña"
                                        >
                                            <KeyRound size={18} />
                                        </button>
                                        <button
                                            onClick={() => openDelete(user.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Desactivar usuario"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveUser}
                userToEdit={editingUser}
            />

            <PromptModal
                isOpen={isResetOpen}
                title="Resetear Contraseña"
                message={`Ingrese la nueva contraseña para ${resetTargetUser?.name}:`}
                value={newPassword}
                onChange={setNewPassword}
                onConfirm={confirmResetPassword}
                onCancel={() => setIsResetOpen(false)}
                inputType="password"
                placeholder="Mínimo 6 caracteres"
            />

            <ConfirmationModal
                isOpen={isDeleteOpen}
                title="¿Eliminar Usuario?"
                message="Esta acción borrará al usuario permanentemente y sus ventas quedarán sin asignar. ¿Estás seguro?"
                onConfirm={confirmDelete}
                onClose={() => setIsDeleteOpen(false)}
                type="danger"
            />
        </div>
    );
}

// UserModal Component (kept below as is)
function UserModal({ isOpen, onClose, onSubmit, userToEdit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: UserFormData) => void;
    userToEdit: Profile | null
}) {
    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        password: '',
        nombre: '',
        carnet: '',
        rol: 'garzon'
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (userToEdit) {
            setFormData({
                email: userToEdit.email || '',
                password: '', // Password cannot be retrieved
                nombre: userToEdit.nombre_completo,
                carnet: userToEdit.carnet_identidad || '',
                rol: userToEdit.rol
            });
        } else {
            setFormData({
                email: '',
                password: '',
                nombre: '',
                carnet: '',
                rol: 'garzon'
            });
        }
    }, [userToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        await onSubmit(formData);
        setLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        {userToEdit ? <Pencil size={24} className="text-blue-600" /> : <UserPlus size={24} className="text-red-600" />}
                        {userToEdit ? 'Editar Usuario' : 'Nuevo Usuario'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nombre Completo</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
                            value={formData.nombre}
                            onChange={e => setFormData({ ...formData, nombre: e.target.value })}
                            required
                            placeholder="Ej. Juan Pérez"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Carnet de Identidad</label>
                        <input
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
                            value={formData.carnet}
                            onChange={e => setFormData({ ...formData, carnet: e.target.value })}
                            required
                            placeholder="Ej. 1234567 SC"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Rol</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none bg-white"
                            value={formData.rol}
                            onChange={e => setFormData({ ...formData, rol: e.target.value as UserFormData['rol'] })}
                        >
                            <option value="garzon">Garzón (Mesero)</option>
                            <option value="cajero">Cajero</option>
                            <option value="cocina">Cocina</option>
                            <option value="bar">Bar</option>
                            <option value="administrador">Administrador</option>
                        </select>
                    </div>

                    {/* Email and Password are only editable on Creation for now */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">
                            Usuario (Login)
                            {userToEdit && <span className="ml-2 text-xs font-normal text-gray-500">(No editable)</span>}
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none disabled:bg-gray-100 disabled:text-gray-500 uppercase font-mono"
                            value={formData.email.replace('@locotos.system', '')}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                            disabled={!!userToEdit}
                            placeholder="Ej. JCRUZ"
                        />
                    </div>

                    {!userToEdit && (
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
                            <input
                                type="password"
                                className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-red-500 outline-none"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required={!userToEdit}
                                minLength={6}
                                placeholder="******"
                            />
                        </div>
                    )}

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
                            disabled={loading}
                            className={`px-6 py-2.5 text-white font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${userToEdit ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'
                                }`}
                        >
                            {loading ? 'Procesando...' : (
                                <>
                                    {userToEdit ? <CheckCircle size={20} /> : <UserPlus size={20} />}
                                    {userToEdit ? 'Guardar Cambios' : 'Crear Usuario'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

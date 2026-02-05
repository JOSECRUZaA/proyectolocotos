import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
// import Dashboard from './pages/Dashboard'; // Removed
import Login from './pages/Login';
import TableMap from './pages/TableMap';
import OrderCreation from './pages/OrderCreation';
import ProductionView from './pages/ProductionView';
import CashSession from './pages/cashier/CashSession';
import OrderPayment from './pages/cashier/OrderPayment';
import DailySales from './pages/cashier/DailySales';
import ReportsDashboard from './pages/admin/ReportsDashboard';
import ProductManagement from './pages/admin/ProductManagement';
import UserManagement from './pages/admin/UserManagement';
import TableManagement from './pages/admin/TableManagement';
import WaiterOrderMonitor from './pages/waiter/WaiterOrderMonitor';
import OnlineUsersPage from './pages/admin/OnlineUsersPage';
import { OnlineUsersProvider } from './contexts/OnlineUsersContext';
import { ShiftProvider } from './contexts/ShiftContext';
import ShiftGate from './components/ShiftGate';
import ActiveSessions from './pages/admin/ActiveSessions';
import StaffMonitor from './pages/admin/StaffMonitor';
import MyShift from './pages/staff/MyShift';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showTimeout, setShowTimeout] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Verificando sesión...</p>
      {showTimeout && (
        <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg max-w-md text-center border border-yellow-200 animate-in fade-in">
          <p className="font-bold mb-2">⚠ Tiempo de espera excedido</p>
          <p className="text-sm mb-3">No pudimos verificar tu sesión. Intenta recargar.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors pointer-events-auto"
          >
            Recargar Página
          </button>
        </div>
      )}
    </div>
  );

  if (!user) return <Navigate to="/login" />;

  return <>{children}</>;
}

function RoleBasedRedirect() {
  const { profile, loading } = useAuth();
  const [showTimeout, setShowTimeout] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowTimeout(true), 5000); // 5s timeout
    return () => clearTimeout(timer);
  }, []);

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mb-4"></div>
      <p className="text-gray-600 font-medium">Cargando sistema...</p>
      {showTimeout && (
        <div className="mt-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg max-w-md text-center border border-yellow-200 shadow-sm animate-in fade-in slide-in-from-bottom-2">
          <p className="font-bold mb-2">⚠ Tiempo de espera excedido</p>
          <p className="text-sm mb-3">La conexión está tardando más de lo esperado. Verifica tu internet.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors pointer-events-auto"
          >
            Recargar Página
          </button>
        </div>
      )}
    </div>
  );

  if (!profile) return <Navigate to="/login" />;

  switch (profile.rol) {
    case 'cocina': return <Navigate to="/cocina" />;
    case 'bar': return <Navigate to="/bar" />;
    default: return <Navigate to="/mesas" />;
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OnlineUsersProvider>
          <ShiftProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }>
                <Route index element={<RoleBasedRedirect />} />
                {/* OPERATIONAL (SHIFT REQUIRED) */}
                <Route element={<ShiftGate><Outlet /></ShiftGate>}>
                  <Route path="mesas" element={<TableMap />} />
                  <Route path="mesas/pedidos" element={<WaiterOrderMonitor />} />
                  <Route path="mesas/:tableId/nueva-orden" element={<OrderCreation />} />
                  <Route path="cocina" element={<ProductionView area="cocina" />} />
                  <Route path="bar" element={<ProductionView area="bar" />} />
                  <Route path="caja" element={<CashSession />} />
                  <Route path="caja/cobrar/:tableId" element={<OrderPayment />} />
                  <Route path="mi-asistencia" element={<MyShift />} />
                </Route>
                <Route path="ventas-diarias" element={<DailySales />} />
                <Route path="admin/reportes" element={<ReportsDashboard />} />
                <Route path="admin/productos" element={<ProductManagement />} />
                <Route path="admin/usuarios" element={<UserManagement />} />
                <Route path="admin/mesas" element={<TableManagement />} />
                <Route path="admin/online" element={<OnlineUsersPage />} />
                <Route path="admin/personal" element={<StaffMonitor />} />
                <Route path="admin/cajas" element={<ActiveSessions />} />
              </Route>
            </Routes>
          </ShiftProvider>
        </OnlineUsersProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

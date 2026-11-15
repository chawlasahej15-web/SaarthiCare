import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { SaarthiCareProvider, useSaarthiCare } from './context/SaarthiCareContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { MedicationsPage } from './pages/MedicationsPage';
import { AppointmentsPage } from './pages/AppointmentsPage';
import { SaarthiCarePage } from './pages/SaarthiCarePage';
import { SettingsPage } from './pages/SettingsPage';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { ElderDashboard } from './pages/ElderDashboard';
import { Button } from './components/ui';

function ToastHost() {
  const { toast, dismissToast } = useSaarthiCare();
  return toast ? <div className="toast" role="status"><span>✓</span>{toast}<Button variant="ghost" size="sm" onClick={dismissToast}>Dismiss</Button></div> : null;
}


function AuthLanding() {
  const { state, remoteReady, remoteError } = useSaarthiCare();
  if (!remoteReady) return <div className="auth-loading">Opening your care workspace…</div>;
  if (remoteError) return <Navigate to="/login" replace />;
  return <Navigate to={state.activeRole === 'owner' || state.activeRole === 'patient' ? '/elder' : '/dashboard'} replace />;
}

function AppRoutes() {
  return <><Routes>
    <Route path="/" element={<Navigate to="/welcome" replace />} />
    <Route path="/welcome" element={<WelcomePage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}>
      <Route path="/continue" element={<AuthLanding />} />
      <Route path="/elder" element={<ElderDashboard />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/medications" element={<MedicationsPage />} />
        <Route path="/appointments" element={<AppointmentsPage />} />
        <Route path="/care-circle" element={<SaarthiCarePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes><ToastHost /></>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><SaarthiCareProvider><AppRoutes /></SaarthiCareProvider></AuthProvider></BrowserRouter>;
}

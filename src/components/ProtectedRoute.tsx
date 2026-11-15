import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isFirebaseConfigured } from '../lib/firebase';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (!isFirebaseConfigured) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (loading) return <div className="auth-loading">Loading your secure workspace…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function PublicOnlyRoute() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div role="status" aria-live="polite" style={{ padding: '2rem' }}>
        Loading…
      </div>
    );
  }

  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
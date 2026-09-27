import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function DashboardLayout() {
  const { tenant, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="tenant-name">{tenant?.name}</span>
        <button type="button" onClick={handleLogout}>
          Log out
        </button>
      </header>

      <div className="app-body">
        <nav aria-label="Main navigation">
          <ul>
            <li><NavLink to="/dashboard" end>Overview</NavLink></li>
            <li><NavLink to="/dashboard/widgets">Widgets</NavLink></li>
            <li><NavLink to="/dashboard/submissions">Submissions</NavLink></li>
          </ul>
        </nav>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
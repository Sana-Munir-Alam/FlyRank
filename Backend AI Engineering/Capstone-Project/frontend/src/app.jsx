import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardLayout } from './pages/DashboardLayout';
import { DashboardHome } from './pages/DashboardHome';
import { WidgetsListPage } from './pages/WidgetsListPage';
import { WidgetFormPage } from './pages/WidgetFormPage';
import { WidgetDetailPage } from './pages/WidgetDetailPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicOnlyRoute } from './components/PublicOnlyRoute';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="widgets" element={<WidgetsListPage />} />
          <Route path="widgets/new" element={<WidgetFormPage />} />
          <Route path="widgets/:id" element={<WidgetDetailPage />} />
          <Route path="widgets/:id/edit" element={<WidgetFormPage />} />
          {/* /dashboard/submissions added in Stage 12 */}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
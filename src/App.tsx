import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LoginPage from './components/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppAlertHost from './components/ui/AppAlertHost';
import DashboardPage from './pages/DashboardPage';
import RelatiesPage from './pages/RelatiesPage';
import NotesPage from './pages/NotesPage';
import MailboxPage from './pages/MailboxPage';
import DatabasePage from './pages/DatabasePage';
import SettingsPage from './pages/SettingsPage';
import BeheerPage from './pages/BeheerPage';
import { useAuth } from './auth/AuthContext';
import { getDefaultRoute, hasAccessToRoute } from './lib/routing';

export default function App() {
  const { user } = useAuth();
  const defaultRoute = getDefaultRoute(user);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route
              index
              element={hasAccessToRoute(user, '/') ? <DashboardPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="relaties"
              element={hasAccessToRoute(user, '/relaties') ? <RelatiesPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="notes"
              element={hasAccessToRoute(user, '/notes') ? <NotesPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="mailbox"
              element={hasAccessToRoute(user, '/mailbox') ? <MailboxPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="database"
              element={hasAccessToRoute(user, '/database') ? <DatabasePage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="settings"
              element={hasAccessToRoute(user, '/settings') ? <SettingsPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route
              path="beheer"
              element={hasAccessToRoute(user, '/beheer') ? <BeheerPage /> : <Navigate to={defaultRoute} replace />}
            />
            <Route path="*" element={<Navigate to={defaultRoute} replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <AppAlertHost />
    </>
  );
}

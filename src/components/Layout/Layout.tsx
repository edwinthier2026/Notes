import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar, { MobileMenuButton } from './Sidebar';
import { useAuth } from '../../auth/AuthContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-dc-gray-50">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        user={user}
        onLogout={logout}
      />
      <MobileMenuButton onClick={() => setSidebarOpen(true)} />
      <main className={`${sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-44'} min-h-screen transition-[margin] duration-200`}>
        <div className="p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

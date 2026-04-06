import { NavLink } from 'react-router-dom';
import {
  BookOpenText,
  ChevronsLeft,
  ChevronsRight,
  DatabaseZap,
  LayoutDashboard,
  Users,
  LogOut,
  Mail,
  Menu,
  Settings,
  Shield,
  StickyNote,
  X,
} from 'lucide-react';
import type { IngelogdeGebruiker } from '../../types';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user: IngelogdeGebruiker;
  onLogout: () => void;
}

type MenuItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
};

function initialsFromName(naam: string): string {
  return naam
    .split(' ')
    .map((woord) => woord[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getVisibleMenuItems(user: IngelogdeGebruiker) {
  const items: MenuItem[] = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/relaties', label: 'Relaties', icon: Users },
    { to: '/notes', label: 'Notities', icon: StickyNote },
    { to: '/mailbox', label: 'Mailbox', icon: Mail },
    { to: '/database', label: 'Database', icon: DatabaseZap },
    { to: '/settings', label: 'Instellingen', icon: Settings },
  ];

  const adminItems: MenuItem[] = user.beheer ? [{ to: '/beheer', label: 'Beheer', icon: Shield }] : [];
  return { items, adminItems };
}

export default function Sidebar({ open, onClose, collapsed, onToggleCollapsed, user, onLogout }: SidebarProps) {
  const { items, adminItems } = getVisibleMenuItems(user);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `relative flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'text-[#11d8d4] before:content-[""] before:absolute before:left-1.5 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-1 before:rounded-full before:bg-[#11d8d4]'
        : 'text-gray-300 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 left-0 z-50 h-full ${collapsed ? 'w-16' : 'w-44'} bg-[#002060] flex flex-col transition-[width,transform] duration-200 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div
          className={`relative flex items-center ${collapsed ? 'justify-center px-2 py-4 min-h-[72px]' : 'justify-between px-4 py-5 min-h-[105px]'} border-b border-white/10`}
        >
          {!collapsed ? (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
                <BookOpenText className="h-6 w-6 text-[#11d8d4]" />
              </div>
              <div>
                <div className="text-white text-lg font-semibold">Notes</div>
                <div className="text-xs text-blue-100/70">MariaDB</div>
              </div>
            </div>
          ) : (
            <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center">
              <BookOpenText className="h-6 w-6 text-[#11d8d4]" />
            </div>
          )}

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden lg:flex items-center justify-center text-blue-200 hover:text-white transition-colors"
            title={collapsed ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'}
            aria-label={collapsed ? 'Zijbalk uitklappen' : 'Zijbalk inklappen'}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>

          <button onClick={onClose} className="lg:hidden absolute right-5 text-gray-400 hover:text-white" aria-label="Sluiten">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 flex flex-col px-3 pt-4 pb-2 overflow-y-auto">
          <div className="space-y-1">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass} onClick={onClose} title={collapsed ? item.label : undefined}>
                <item.icon size={18} />
                {!collapsed ? item.label : null}
              </NavLink>
            ))}
          </div>

          {adminItems.length > 0 && <div className="mt-auto pt-2 border-t border-white/10" />}

          {adminItems.length > 0 && (
            <div className="pt-2">
              {adminItems.map((item) => (
                <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose} title={collapsed ? item.label : undefined}>
                  <item.icon size={18} />
                  {!collapsed ? item.label : null}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className={`${collapsed ? 'px-3' : 'px-5'} py-4 border-t border-white/10 space-y-3`}>
          {import.meta.env.DEV ? (
            collapsed ? (
              <div className="flex justify-center">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" title="Development (Lokaal)" />
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                <span className="text-yellow-300 text-xs font-medium">Development (Lokaal)</span>
              </div>
            )
          ) : collapsed ? (
            <div className="flex justify-center">
              <span className="w-2 h-2 bg-green-400 rounded-full" title="Productie" />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30">
              <span className="w-2 h-2 bg-green-400 rounded-full" />
              <span className="text-green-300 text-xs font-medium">Productie</span>
            </div>
          )}

          <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-8 h-8 rounded-full bg-dc-blue-500/30 flex items-center justify-center text-dc-blue-300 text-xs font-bold">
              {initialsFromName(user.naam)}
            </div>
            {!collapsed ? (
              <div className="flex-1 min-w-0">
                <div className="text-white text-sm font-medium truncate">{user.naam}</div>
                <div className="text-gray-400 text-xs">{user.functie}</div>
              </div>
            ) : null}
            <button onClick={onLogout} className="text-gray-400 hover:text-white" title="Uitloggen" aria-label="Uitloggen">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden fixed top-4 left-4 z-30 bg-[#002060] text-white p-2 rounded-lg shadow-lg">
      <Menu size={20} />
    </button>
  );
}

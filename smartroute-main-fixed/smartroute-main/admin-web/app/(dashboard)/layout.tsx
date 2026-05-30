'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getRole, getName, logout } from '@/lib/auth';
import {
  LayoutDashboard, Truck, Package, Clock, AlertTriangle, Users, BarChart2, LogOut, Menu, X
} from 'lucide-react';

const navItems = [
  { href: '/overview',     label: 'Overview',     icon: LayoutDashboard },
  { href: '/fleet',        label: 'Fleet',        icon: Truck },
  { href: '/orders',       label: 'Orders',       icon: Package },
  { href: '/queue',        label: 'Queue',        icon: Clock },
  { href: '/escalations',  label: 'Escalations',  icon: AlertTriangle },
  { href: '/users',        label: 'Users',        icon: Users },
  { href: '/stats',        label: 'Stats',        icon: BarChart2 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login');
      return;
    }
    setName(getName() || '');
    setRole(getRole() || '');
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 fixed h-full z-10`}>
        
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-gray-200 justify-between">
          {sidebarOpen && <span className="font-bold text-gray-900 text-lg">SmartRoute</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-0.5 px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
              >
                <Icon size={18} className="flex-shrink-0" />
                {sidebarOpen && <span>{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        {sidebarOpen && (
          <div className="p-4 border-t border-gray-200">
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-500 capitalize">{role}</p>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 font-medium"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-56' : 'ml-16'} transition-all duration-200`}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
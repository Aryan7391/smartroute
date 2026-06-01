'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { User, Session } from '@/types';
import { Users, Shield, LogOut, UserX, UserCheck, Plus, X, CheckCircle, Clock } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [pending, setPending] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'managers' | 'sessions' | 'pending'>('managers');
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', phone: '', password: '', email: '' });
  const [addLoading, setAddLoading] = useState(false);

  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchSessions, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, sessionsRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/sessions'),
      ]);
      const allUsers = usersRes.data;
      setUsers(allUsers.filter((u: User) => u.role === 'manager'));
      setPending(allUsers.filter((u: User) => u.role === 'driver' && !u.is_active));
      setSessions(sessionsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/admin/sessions');
      setSessions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const toggleActive = async (userId: string, current: boolean) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: !current });
      showMessage(`User ${current ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    }
  };

  const approve = async (userId: string) => {
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: true });
      showMessage('Driver approved successfully');
      fetchData();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    }
  };

  const reject = async (userId: string) => {
    if (!confirm('Reject and delete this driver account?')) return;
    try {
      await api.patch(`/admin/users/${userId}`, { is_active: false });
      showMessage('Driver rejected');
      fetchData();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    }
  };

  const kickSession = async (sessionId: string) => {
    try {
      await api.delete(`/admin/sessions/${sessionId}`);
      showMessage('Session terminated');
      fetchSessions();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    }
  };

  const kickAllSessions = async (userId: string) => {
    if (!confirm('Kick all sessions for this user?')) return;
    try {
      await api.delete(`/auth/sessions/user/${userId}`);
      showMessage('All sessions terminated');
      fetchSessions();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed');
    }
  };

  const addManager = async () => {
    setAddLoading(true);
    try {
      await api.post('/admin/users/create', { ...newUser, role: 'manager' });
      showMessage('Manager added successfully');
      setShowAdd(false);
      setNewUser({ name: '', phone: '', password: '', email: '' });
      fetchData();
    } catch (err: any) {
      showMessage(err.response?.data?.detail || 'Failed to add manager');
    } finally {
      setAddLoading(false);
    }
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleString() : '—';

  const filterByDateAndSort = (arr: any[], dateField: string) => {
    return arr
      .filter(item => !dateFilter || (item[dateField] && item[dateField].startsWith(dateFilter)))
      .sort((a, b) => {
        const tA = a[dateField] ? new Date(a[dateField]).getTime() : 0;
        const tB = b[dateField] ? new Date(b[dateField]).getTime() : 0;
        return sortOrder === 'desc' ? tB - tA : tA - tB;
      });
  };

  const filteredUsers = filterByDateAndSort(users, 'created_at');
  const filteredPending = filterByDateAndSort(pending, 'created_at');
  const filteredSessions = filterByDateAndSort(sessions, 'logged_in_at');

  const tabs = [
    { key: 'managers' as const, label: `Managers (${filteredUsers.length})` },
    { key: 'pending'  as const, label: `Pending Drivers (${filteredPending.length})`, alert: filteredPending.length > 0 },
    { key: 'sessions' as const, label: `Sessions (${filteredSessions.length})` },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage managers, drivers and active sessions</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex items-center gap-1"
          >
            Sort: {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 ml-2"
          >
            <Plus size={15} />
            Add Manager
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 bg-blue-50 text-blue-700 text-sm px-4 py-3 rounded-lg">{message}</div>
      )}

      {/* Add Manager Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-gray-200 p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Add Manager</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {['name', 'phone', 'email', 'password'].map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-600 mb-1 capitalize">{field}</label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    value={newUser[field as keyof typeof newUser]}
                    onChange={e => setNewUser({ ...newUser, [field]: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}
              <button
                onClick={addManager}
                disabled={addLoading}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 mt-2"
              >
                {addLoading ? 'Adding...' : 'Add Manager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-2
              ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
            {t.alert && (
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>

      ) : tab === 'managers' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Users size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No managers yet</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Email</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Last Seen</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {u.last_seen ? formatDate(u.last_seen) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(u.id, u.is_active)}
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors
                            ${u.is_active
                              ? 'border-red-200 text-red-500 hover:bg-red-50'
                              : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                        >
                          {u.is_active ? <><UserX size={12} /> Deactivate</> : <><UserCheck size={12} /> Activate</>}
                        </button>
                        <button
                          onClick={() => kickAllSessions(u.id)}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
                        >
                          <LogOut size={12} /> Kick
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      ) : tab === 'pending' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <CheckCircle size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No pending approvals</p>
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50 flex items-center gap-2">
                <Clock size={14} className="text-yellow-600" />
                <p className="text-sm text-yellow-700 font-medium">
                  {filteredPending.length} driver{filteredPending.length > 1 ? 's' : ''} waiting for approval
                </p>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Phone</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Registered</th>
                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.map(u => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{u.phone}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{formatDate(u.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => approve(u.id)}
                            className="flex items-center gap-1 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => reject(u.id)}
                            className="flex items-center gap-1 text-xs border border-red-200 text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <X size={12} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400">
              <Shield size={32} className="mb-2 opacity-50" />
              <p className="text-sm">No active sessions</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Role</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Phone</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Logged In</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Last Active</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map(s => (
                  <tr key={s.session_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full capitalize">
                        {s.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{s.phone}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.logged_in_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(s.last_active)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => kickSession(s.session_id)}
                        className="flex items-center gap-1 text-xs border border-red-200 text-red-500 px-2 py-1 rounded hover:bg-red-50"
                      >
                        <LogOut size={12} /> Kick
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
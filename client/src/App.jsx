import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { LayoutDashboard, Calendar, Phone, Scissors, Clock, Settings, LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from './AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import Dashboard from './pages/Dashboard'
import Appointments from './pages/Appointments'
import CallLog from './pages/CallLog'
import Services from './pages/Services'
import BusinessHours from './pages/BusinessHours'
import SettingsPage from './pages/Settings'
import StorePage from './pages/StorePage'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/appointments', icon: Calendar, label: 'Appointments' },
  { to: '/calls', icon: Phone, label: 'Call Log' },
  { to: '/services', icon: Scissors, label: 'Services' },
  { to: '/hours', icon: Clock, label: 'Hours' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function StoreAdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.isSuperAdmin) return <Navigate to="/admin" replace />
  return children
}

function SuperAdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.isSuperAdmin) return <Navigate to="/" replace />
  return children
}

function StoreShell() {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Phone className="w-6 h-6 text-emerald-400" />
            Receiver
          </h1>
          <p className="text-xs text-gray-400 mt-1 truncate">{user?.storeName || 'AI Voice Booking'}</p>
        </div>
        <nav className="flex-1 px-3">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">Agent Active</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 truncate max-w-[140px]">{user?.email}</span>
            <button onClick={logout} className="text-gray-500 hover:text-white transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/calls" element={<CallLog />} />
          <Route path="/services" element={<Services />} />
          <Route path="/hours" element={<BusinessHours />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/store/:slug" element={<StorePage />} />
        <Route path="/admin" element={
          <SuperAdminRoute>
            <AdminDashboard />
          </SuperAdminRoute>
        } />
        <Route path="/*" element={
          <StoreAdminRoute>
            <StoreShell />
          </StoreAdminRoute>
        } />
      </Routes>
    </AuthProvider>
  )
}

export default App

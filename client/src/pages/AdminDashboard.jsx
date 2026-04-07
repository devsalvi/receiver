import { useState, useEffect } from 'react'
import { api } from '../api'
import { useAuth } from '../AuthContext'
import { Plus, Store, Trash2, X, Phone, LogOut, Eye } from 'lucide-react'

export default function AdminDashboard() {
  const { logout } = useAuth()
  const [stores, setStores] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [selectedStore, setSelectedStore] = useState(null)

  const load = () => {
    Promise.all([api.admin.getStores(), api.admin.getStats()])
      .then(([s, st]) => { setStores(s); setStats(st) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const deleteStore = async (id, name) => {
    if (!confirm(`Delete store "${name}" and all its data? This cannot be undone.`)) return
    await api.admin.deleteStore(id)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Phone className="w-6 h-6 text-emerald-400" />
            <div>
              <h1 className="text-lg font-bold">Receiver Admin</h1>
              <p className="text-xs text-gray-400">Super Admin Panel</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Stores', value: stats.totalStores },
              { label: 'Total Appointments', value: stats.totalAppointments },
              { label: 'Total Calls', value: stats.totalCalls },
              { label: 'Total Customers', value: stats.totalCustomers },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Stores */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Stores</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" /> Add Store
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Store</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Admin Email</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Appointments</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Customers</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Calls</th>
                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Created</th>
                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
              )}
              {!loading && stores.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-400">No stores yet. Click "Add Store" to create one.</td></tr>
              )}
              {stores.map(store => (
                <tr key={store.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{store.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">{store.owner_email}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{store.appointment_count}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{store.customer_count}</td>
                  <td className="px-5 py-3 text-sm text-gray-600">{store.call_count}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {store.created_at ? new Date(store.created_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedStore(store)} className="text-gray-400 hover:text-emerald-600" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteStore(store.id, store.name)} className="text-gray-400 hover:text-red-600" title="Delete store">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && <CreateStoreModal onClose={() => { setShowCreate(false); load() }} />}
      {selectedStore && <StoreDetailModal store={selectedStore} onClose={() => setSelectedStore(null)} />}
    </div>
  )
}

function CreateStoreModal({ onClose }) {
  const [form, setForm] = useState({ store_name: '', admin_email: '', admin_password: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const result = await api.admin.createStore(form)
      setSuccess(result.message)
      setForm({ store_name: '', admin_email: '', admin_password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Add New Store</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          {success && <p className="text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded">{success}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Store Name</label>
            <input required value={form.store_name} onChange={e => setForm({ ...form, store_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Mike's Barber Shop" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
            <input required type="email" value={form.admin_email} onChange={e => setForm({ ...form, admin_email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="owner@barbershop.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
            <input required type="text" value={form.admin_password} onChange={e => setForm({ ...form, admin_password: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Min 8 chars (they'll change it on first login)" />
            <p className="text-xs text-gray-400 mt-1">The store admin will be prompted to set a new password on first login.</p>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Store'}
          </button>
        </form>
      </div>
    </div>
  )
}

function StoreDetailModal({ store, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.admin.getStore(store.id).then(setDetail).catch(console.error).finally(() => setLoading(false))
  }, [store.id])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{store.name}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <div className="p-5 overflow-auto flex-1">
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Details</h4>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">Email:</span> {detail.owner_email}</p>
                  <p><span className="text-gray-500">Phone:</span> {detail.phone || 'Not set'}</p>
                  <p><span className="text-gray-500">Address:</span> {detail.address || 'Not set'}</p>
                  <p><span className="text-gray-500">Timezone:</span> {detail.timezone}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-1">Stats</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{detail.stats.appointments}</p>
                    <p className="text-xs text-gray-500">Appointments</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{detail.stats.customers}</p>
                    <p className="text-xs text-gray-500">Customers</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-gray-900">{detail.stats.calls}</p>
                    <p className="text-xs text-gray-500">Calls</p>
                  </div>
                </div>
              </div>
              {detail.services?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Services</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.services.map(s => (
                      <span key={s.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {s.name} ({s.duration_minutes}min)
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {detail.barbers?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Barbers</h4>
                  <div className="flex flex-wrap gap-2">
                    {detail.barbers.map(b => (
                      <span key={b.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-500">Failed to load details</p>
          )}
        </div>
      </div>
    </div>
  )
}

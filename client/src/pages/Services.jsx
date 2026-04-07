import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react'

export default function Services() {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = () => {
    api.getServices().then(setServices).catch(console.error).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const deleteService = async (id) => {
    if (!confirm('Remove this service?')) return
    await api.deleteService(id)
    load()
  }

  const saveEdit = async () => {
    await api.updateService(editing.id, editing)
    setEditing(null)
    load()
  }

  const addService = async (data) => {
    await api.createService(data)
    setShowAdd(false)
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Services</h2>
          <p className="text-sm text-gray-500 mt-1">Manage the services your AI agent can book</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> Add Service
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map(service => (
          <div key={service.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            {editing?.id === service.id ? (
              <div className="space-y-3">
                <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="flex gap-2">
                  <input type="number" value={editing.duration_minutes} onChange={e => setEditing({ ...editing, duration_minutes: +e.target.value })}
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm" placeholder="Minutes" />
                  <input type="number" value={(editing.price_cents || 0) / 100} onChange={e => setEditing({ ...editing, price_cents: Math.round(e.target.value * 100) })}
                    className="w-1/2 border rounded-lg px-3 py-2 text-sm" placeholder="Price $" step="0.01" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="flex-1 bg-emerald-600 text-white py-1.5 rounded-lg text-sm"><Check className="w-4 h-4 inline" /> Save</button>
                  <button onClick={() => setEditing(null)} className="flex-1 border py-1.5 rounded-lg text-sm text-gray-600">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing({ ...service })} className="p-1 text-gray-400 hover:text-gray-600">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteService(service.id)} className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>{service.duration_minutes} min</span>
                  {service.price_cents > 0 && <span>${(service.price_cents / 100).toFixed(2)}</span>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {showAdd && <AddServiceModal onClose={() => setShowAdd(false)} onSave={addService} />}
    </div>
  )
}

function AddServiceModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', duration_minutes: 30, price_cents: 0 })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-sm mx-4 shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Add Service</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g. Haircut" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
              <input type="number" required value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: +e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
              <input type="number" step="0.01" value={form.price_cents / 100} onChange={e => setForm({ ...form, price_cents: Math.round(e.target.value * 100) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm hover:bg-emerald-700">
            Add Service
          </button>
        </form>
      </div>
    </div>
  )
}

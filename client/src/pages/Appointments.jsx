import { useState, useEffect } from 'react'
import { api } from '../api'
import { format } from 'date-fns'
import { Plus, X } from 'lucide-react'

export default function Appointments() {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filter, setFilter] = useState('upcoming')

  const load = () => {
    const params = {}
    if (filter === 'upcoming') {
      params.from = new Date().toISOString()
      params.status = 'confirmed'
    } else if (filter !== 'all') {
      params.status = filter
    }
    api.getAppointments(params)
      .then(data => setAppointments(data.appointments))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { setLoading(true); load() }, [filter])

  const cancel = async (id) => {
    if (!confirm('Cancel this appointment?')) return
    await api.updateAppointment(id, { status: 'cancelled' })
    load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Appointments</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4" /> New Appointment
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {['upcoming', 'confirmed', 'cancelled', 'completed', 'all'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm capitalize ${
              filter === f ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Customer</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Service</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Barber</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Date & Time</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
              <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {!loading && appointments.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No appointments found</td></tr>
            )}
            {appointments.map(apt => (
              <tr key={apt.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900">{apt.customer_name}</p>
                  <p className="text-xs text-gray-500">{apt.customer_phone}</p>
                </td>
                <td className="px-5 py-3 text-sm text-gray-700">{apt.service_name || '-'}</td>
                <td className="px-5 py-3 text-sm text-gray-700">{apt.barber_name || '-'}</td>
                <td className="px-5 py-3">
                  <p className="text-sm text-gray-900">{format(new Date(apt.start_time), 'MMM d, yyyy')}</p>
                  <p className="text-xs text-gray-500">{format(new Date(apt.start_time), 'h:mm a')}</p>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                    apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    apt.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {apt.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {apt.status === 'confirmed' && (
                    <button onClick={() => cancel(apt.id)} className="text-xs text-red-600 hover:underline">
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Appointment Modal */}
      {showModal && <NewAppointmentModal onClose={() => { setShowModal(false); load() }} />}
    </div>
  )
}

function NewAppointmentModal({ onClose }) {
  const [services, setServices] = useState([])
  const [barbers, setBarbers] = useState([])
  const [form, setForm] = useState({
    customer_name: '', customer_phone: '', service_id: '', barber_id: '',
    date: '', time: ''
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([api.getServices(), api.getBarbers()]).then(([s, b]) => {
      setServices(s); setBarbers(b)
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.createAppointment({
        ...form,
        start_time: `${form.date}T${form.time}:00`
      })
      onClose()
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
          <h3 className="font-semibold text-gray-900">New Appointment</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name</label>
            <input required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input required type="tel" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+1234567890" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
              <select value={form.service_id} onChange={e => setForm({ ...form, service_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select...</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barber</label>
              <select value={form.barber_id} onChange={e => setForm({ ...form, barber_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Any</option>
                {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input required type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input required type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Booking...' : 'Book Appointment'}
          </button>
        </form>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { Phone, MapPin, Clock, Scissors } from 'lucide-react'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function StorePage() {
  const { slug } = useParams()
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedBarber, setSelectedBarber] = useState('')
  const [slots, setSlots] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    api.public.getStore(slug)
      .then(setStore)
      .catch(() => setError('Store not found'))
      .finally(() => setLoading(false))
  }, [slug])

  const checkAvailability = async () => {
    if (!selectedDate) return
    setSlotsLoading(true)
    try {
      const data = await api.public.getAvailability(slug, selectedDate, selectedBarber || undefined)
      setSlots(data)
    } catch {
      setSlots({ available: false, slots: [], message: 'Failed to check availability' })
    } finally {
      setSlotsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedDate) checkAvailability()
  }, [selectedDate, selectedBarber])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400">Loading...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Store not found</h1>
        <p className="text-gray-500">The store you're looking for doesn't exist.</p>
      </div>
    </div>
  )

  // Today's date for min attribute
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">{store.name}</h1>
          </div>
          {store.address && (
            <p className="flex items-center gap-2 text-gray-400 text-sm mt-2">
              <MapPin className="w-4 h-4" /> {store.address}
            </p>
          )}
          {store.phone && (
            <p className="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <Phone className="w-4 h-4" /> {store.phone}
            </p>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Services */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-emerald-600" /> Services
            </h2>
            <div className="space-y-2">
              {store.services.map(s => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.duration_minutes} min</p>
                  </div>
                  {s.price_cents > 0 && (
                    <span className="text-sm font-semibold text-gray-900">
                      ${(s.price_cents / 100).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Hours */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" /> Hours
            </h2>
            <div className="space-y-1">
              {store.hours.map(h => {
                const isToday = new Date().getDay() === h.day_of_week;
                return (
                  <div key={h.day_of_week} className={`flex items-center justify-between py-1.5 text-sm ${isToday ? 'font-semibold text-emerald-700' : 'text-gray-700'}`}>
                    <span>{DAYS[h.day_of_week]}{isToday && ' (Today)'}</span>
                    <span>{h.is_closed ? 'Closed' : `${formatTime(h.open_time)} – ${formatTime(h.close_time)}`}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Book Appointment */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
          <h2 className="font-semibold text-gray-900 mb-4">Check Availability</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input type="date" min={today} value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            {store.barbers.filter(b => b.name !== 'Any Available').length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Barber</label>
                <select value={selectedBarber} onChange={e => setSelectedBarber(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Any</option>
                  {store.barbers.filter(b => b.name !== 'Any Available').map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {slotsLoading && <p className="text-sm text-gray-400">Checking availability...</p>}

          {slots && !slotsLoading && (
            <>
              {!slots.available ? (
                <p className="text-sm text-gray-500">{slots.message || 'No availability on this day'}</p>
              ) : (
                <div>
                  <p className="text-sm text-gray-500 mb-2">Available time slots:</p>
                  <div className="flex flex-wrap gap-2">
                    {slots.slots.filter(s => s.available).map(slot => (
                      <span key={slot.time} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium border border-emerald-200">
                        {formatSlotTime(slot.time)}
                      </span>
                    ))}
                    {slots.slots.filter(s => s.available).length === 0 && (
                      <p className="text-sm text-gray-500">All slots are booked for this day.</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {!selectedDate && !slotsLoading && (
            <p className="text-sm text-gray-400">Select a date to see available times.</p>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              To book an appointment, call us{store.phone ? ` at ${store.phone}` : ''} and our AI assistant will help you find the perfect time.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 mb-4">
          <p className="text-xs text-gray-400">Powered by Receiver — AI Voice Booking</p>
        </div>
      </div>
    </div>
  )
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number);
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatSlotTime(isoTime) {
  const d = new Date(isoTime);
  const h = d.getHours ? d.getHours() : parseInt(isoTime.split('T')[1].split(':')[0]);
  const m = isoTime.split('T')[1].split(':')[1];
  const hour12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hour12}:${m} ${ampm}`;
}

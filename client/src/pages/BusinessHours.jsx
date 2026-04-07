import { useState, useEffect } from 'react'
import { api } from '../api'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default function BusinessHours() {
  const [hours, setHours] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.getBusiness().then(data => {
      setHours(data.hours || [])
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  const update = (dayOfWeek, field, value) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
    ))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.updateHours(hours)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Hours</h2>
          <p className="text-sm text-gray-500 mt-1">Set when your AI agent can book appointments</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="divide-y divide-gray-100">
          {hours.map(h => (
            <div key={h.day_of_week} className="px-5 py-4 flex items-center gap-6">
              <div className="w-28">
                <span className="text-sm font-medium text-gray-900">{DAYS[h.day_of_week]}</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!h.is_closed}
                  onChange={e => update(h.day_of_week, 'is_closed', !e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-600">{h.is_closed ? 'Closed' : 'Open'}</span>
              </label>
              {!h.is_closed && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={h.open_time}
                    onChange={e => update(h.day_of_week, 'open_time', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                  <span className="text-gray-400">to</span>
                  <input
                    type="time"
                    value={h.close_time}
                    onChange={e => update(h.day_of_week, 'close_time', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

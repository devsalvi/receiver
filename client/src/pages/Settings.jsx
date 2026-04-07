import { useState, useEffect } from 'react'
import { api } from '../api'
import { ExternalLink } from 'lucide-react'

export default function SettingsPage() {
  const [business, setBusiness] = useState(null)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([api.getBusiness(), api.getGoogleStatus()])
      .then(([biz, gStatus]) => {
        setBusiness(biz)
        setGoogleConnected(gStatus.connected)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      await api.updateBusiness(business)
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
    <div className="p-8 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Settings</h2>

      {/* Business Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">Business Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name</label>
            <input value={business?.name || ''} onChange={e => setBusiness({ ...business, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input value={business?.phone || ''} onChange={e => setBusiness({ ...business, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="+1234567890" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input value={business?.address || ''} onChange={e => setBusiness({ ...business, address: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select value={business?.timezone || 'America/New_York'} onChange={e => setBusiness({ ...business, timezone: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="America/New_York">Eastern</option>
              <option value="America/Chicago">Central</option>
              <option value="America/Denver">Mountain</option>
              <option value="America/Los_Angeles">Pacific</option>
            </select>
          </div>
        </div>
        <button onClick={save} disabled={saving}
          className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
          {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* AI Agent */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h3 className="font-semibold text-gray-900 mb-4">AI Agent Greeting</h3>
        <p className="text-sm text-gray-500 mb-3">Customize what the AI says when it answers a call. Use {'{shop_name}'} as a placeholder.</p>
        <textarea
          rows={3}
          value={business?.greeting_message || ''}
          onChange={e => setBusiness({ ...business, greeting_message: e.target.value })}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={save} disabled={saving}
          className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
          Save
        </button>
      </div>

      {/* Integrations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Integrations</h3>

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Google Calendar</p>
            <p className="text-xs text-gray-500">Sync appointments to your Google Calendar</p>
          </div>
          {googleConnected ? (
            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Connected</span>
          ) : (
            <a href="/api/auth/google" className="flex items-center gap-1 text-sm text-emerald-600 hover:underline">
              Connect <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-900">Twilio SMS</p>
            <p className="text-xs text-gray-500">Send confirmation and reminder texts</p>
          </div>
          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded-full">
            Configure in .env
          </span>
        </div>

        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-gray-900">ElevenLabs Voice AI</p>
            <p className="text-xs text-gray-500">AI voice agent for inbound call handling</p>
          </div>
          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">
            Active
          </span>
        </div>
      </div>
    </div>
  )
}

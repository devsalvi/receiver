import { useState, useEffect } from 'react'
import { api } from '../api'
import { format } from 'date-fns'
import { PhoneIncoming, X } from 'lucide-react'

export default function CallLog() {
  const [calls, setCalls] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCall, setSelectedCall] = useState(null)

  useEffect(() => {
    api.getCalls().then(data => setCalls(data.calls)).catch(console.error).finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Call Log</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Caller</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Duration</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">Summary</th>
              <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">Transcript</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
            {!loading && calls.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No calls recorded yet. Calls will appear here once your Vapi agent starts receiving calls.</td></tr>
            )}
            {calls.map(call => (
              <tr key={call.id} className="hover:bg-gray-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <PhoneIncoming className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{call.customer_name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{call.customer_phone || '-'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    call.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    call.status === 'failed' ? 'bg-red-100 text-red-700' :
                    call.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {call.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-gray-700">
                  {call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, '0')}` : '-'}
                </td>
                <td className="px-5 py-3 text-sm text-gray-700">
                  {call.started_at ? format(new Date(call.started_at), 'MMM d, h:mm a') : '-'}
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 max-w-xs truncate">
                  {call.summary || '-'}
                </td>
                <td className="px-5 py-3 text-right">
                  {call.transcript && (
                    <button onClick={() => setSelectedCall(call)} className="text-xs text-emerald-600 hover:underline">
                      View
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Transcript Modal */}
      {selectedCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl mx-4 shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-900">Call Transcript</h3>
              <button onClick={() => setSelectedCall(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              <div className="mb-3 text-sm text-gray-500">
                {selectedCall.customer_phone} &middot; {selectedCall.started_at && format(new Date(selectedCall.started_at), 'MMM d, yyyy h:mm a')}
                {selectedCall.duration_seconds && ` &middot; ${Math.round(selectedCall.duration_seconds / 60)} min`}
              </div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {selectedCall.transcript}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

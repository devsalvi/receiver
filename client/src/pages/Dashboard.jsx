import { useState, useEffect } from 'react'
import { api } from '../api'
import { Phone, Calendar, Users, PhoneIncoming } from 'lucide-react'
import { format } from 'date-fns'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getStats().then(setStats).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-gray-500">Loading...</div>
  if (!stats) return <div className="p-8 text-red-500">Failed to load dashboard</div>

  const statCards = [
    { label: "Today's Appointments", value: stats.todayAppointments, icon: Calendar, color: 'bg-emerald-500' },
    { label: 'Total Bookings', value: stats.totalAppointments, icon: Calendar, color: 'bg-blue-500' },
    { label: 'Total Calls', value: stats.totalCalls, icon: Phone, color: 'bg-purple-500' },
    { label: 'Customers', value: stats.totalCustomers, icon: Users, color: 'bg-amber-500' },
  ]

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`${color} p-2 rounded-lg`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming appointments */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Upcoming Appointments</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.upcomingAppointments.length === 0 && (
              <p className="p-5 text-sm text-gray-400">No upcoming appointments</p>
            )}
            {stats.upcomingAppointments.map((apt) => (
              <div key={apt.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{apt.customer_name}</p>
                  <p className="text-xs text-gray-500">{apt.service_name || 'Appointment'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-900">{format(new Date(apt.start_time), 'MMM d')}</p>
                  <p className="text-xs text-gray-500">{format(new Date(apt.start_time), 'h:mm a')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent calls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Calls</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentCalls.length === 0 && (
              <p className="p-5 text-sm text-gray-400">No calls yet</p>
            )}
            {stats.recentCalls.map((call) => (
              <div key={call.id} className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PhoneIncoming className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{call.customer_phone || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{call.summary?.slice(0, 50) || 'No summary'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    call.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    call.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {call.status}
                  </span>
                  {call.duration_seconds && (
                    <p className="text-xs text-gray-400 mt-1">{Math.round(call.duration_seconds / 60)}m</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

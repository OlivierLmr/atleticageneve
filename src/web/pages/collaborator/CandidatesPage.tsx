import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import type { Application, Athlete, Event, ApplicationStatus, Recommendation } from '@shared/types'

interface ApplicationRow extends Application {
  athlete: Athlete
  event: Event
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  to_review: 'bg-yellow-100 text-yellow-800',
  contract_sent: 'bg-blue-100 text-blue-800',
  counter_offer: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

const REC_COLORS: Record<string, string> = {
  'Highly Recommended': 'bg-green-100 text-green-800',
  'Recommended': 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  'Not Recommended': 'bg-red-100 text-red-800',
}

export default function CandidatesPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: applications = [], isLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['applications', eventFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (eventFilter) params.set('eventId', eventFilter)
      if (statusFilter) params.set('status', statusFilter)
      const qs = params.toString()
      return api.get(`/api/v1/applications${qs ? `?${qs}` : ''}`)
    },
  })

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  // Client-side name search
  const filtered = search
    ? applications.filter(
        (a) =>
          a.athlete.firstName.toLowerCase().includes(search.toLowerCase()) ||
          a.athlete.lastName.toLowerCase().includes(search.toLowerCase())
      )
    : applications

  // Stats
  const stats = {
    total: applications.length,
    toReview: applications.filter((a) => a.status === 'to_review').length,
    inNegotiation: applications.filter((a) =>
      ['contract_sent', 'counter_offer'].includes(a.status)
    ).length,
    confirmed: applications.filter((a) => a.status === 'accepted').length,
  }

  const selectCls =
    'px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold">
              Atletica Genève
            </Link>
            <span className="text-xs text-gray-400">{t('selection.title')}</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
              </span>
            )}
            {user && (
              <button
                onClick={() => logout()}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {t('auth.logout')}
              </button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: t('common.total'), value: stats.total, color: 'text-gray-900' },
            { label: t('dashboard.toReview'), value: stats.toReview, color: 'text-yellow-600' },
            {
              label: t('dashboard.inNegotiation'),
              value: stats.inNegotiation,
              color: 'text-blue-600',
            },
            { label: t('dashboard.confirmed'), value: stats.confirmed, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            className={selectCls}
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">{t('common.all')} {t('athlete.event')}s</option>
            {events
              .filter((e) => e.id !== 'all')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
          </select>

          <select
            className={selectCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('common.all')} statuses</option>
            {(['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn'] as ApplicationStatus[]).map(
              (s) => (
                <option key={s} value={s}>
                  {t(`status.${s}`)}
                </option>
              )
            )}
          </select>

          <input
            type="text"
            placeholder={`${t('common.search')}...`}
            className={`${selectCls} w-48`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} {t('selection.candidates').toLowerCase()}
          </span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">
            {t('common.loading')}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">
            No candidates found
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2.5 text-left font-medium">Athlete</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.event')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">NAT</th>
                  <th className="px-3 py-2.5 text-left font-medium">PB</th>
                  <th className="px-3 py-2.5 text-left font-medium">SB</th>
                  <th className="px-3 py-2.5 text-left font-medium">#WR</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.scoring')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.recommendation')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.estimatedCost')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <tr key={app.id} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5">
                      <Link
                        to={`/collaborator/athletes/${app.id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {app.athlete.lastName}, {app.athlete.firstName}
                      </Link>
                      {app.athlete.managerId && (
                        <span className="ml-1 text-[10px] text-gray-400">MGR</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{app.event.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs ${app.athlete.isSwiss ? 'text-red-600 font-semibold' : app.athlete.isEap ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                        {app.athlete.nationality}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{app.personalBest ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{app.seasonBest ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{app.worldRanking ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      {app.score != null ? (
                        <span className="font-mono text-xs font-medium">
                          {(app.score * 100).toFixed(0)}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {app.recommendation ? (
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            REC_COLORS[app.recommendation] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {app.recommendation}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          STATUS_COLORS[app.status as ApplicationStatus] ?? ''
                        }`}
                      >
                        {t(`status.${app.status}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {app.estTotal > 0
                        ? `CHF ${app.estTotal.toLocaleString()}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { STATUS_COLORS } from '@web/lib/ui-constants'
import type { Application, Athlete, Event, EventCatalog, NegotiationStatus, WaPerformance } from '@shared/types'

// The applications list API returns event with nested catalog
interface ApplicationRow extends Application {
  athlete: Athlete
  event: Event & { catalog: EventCatalog }
  waPerformance: WaPerformance | null
}

const REC_COLORS: Record<string, string> = {
  'Highly Recommended': 'bg-green-100 text-green-800',
  'Recommended': 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  'Not Recommended': 'bg-red-100 text-red-800',
}

// Events API returns flat name/discipline/gender from catalog join
interface EventListItem extends Event {
  name: string
  discipline: string
  gender: string
  perfType: string
}

export default function CandidatesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [eventFilter, setEventFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [search, setSearch] = useState('')

  const { data: applications = [], isLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['applications', eventFilter, statusFilter, managerFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (eventFilter) params.set('eventId', eventFilter)
      if (statusFilter) params.set('negotiationStatus', statusFilter)
      if (managerFilter) params.set('managerId', managerFilter)
      const qs = params.toString()
      return api.get(`/api/v1/applications${qs ? `?${qs}` : ''}`)
    },
  })

  const { data: events = [] } = useQuery<EventListItem[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  const { data: managers = [] } = useQuery<{ id: string; firstName: string; lastName: string }[]>({
    queryKey: ['managers'],
    queryFn: () => api.get('/api/v1/users?role=manager'),
  })

  // Client-side name search
  const filtered = search
    ? applications.filter(
        (a) =>
          a.athlete.firstName.toLowerCase().includes(search.toLowerCase()) ||
          a.athlete.lastName.toLowerCase().includes(search.toLowerCase())
      )
    : applications

  // Stats — negotiationStatus is on athlete, participationStatus is on application
  const stats = {
    total: applications.length,
    toReview: applications.filter((a) => a.athlete.negotiationStatus === 'to_review').length,
    inNegotiation: applications.filter((a) =>
      ['agreement_sent', 'counter_offer_sent'].includes(a.athlete.negotiationStatus)
    ).length,
    confirmed: applications.filter((a) => a.athlete.negotiationStatus === 'confirmed').length,
  }

  const selectCls =
    'px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold">
              {t('selection.title')}
            </span>
          </div>
          <div className="flex items-center gap-3">
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

          {managers.length > 0 && (
            <select
              className={selectCls}
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
            >
              <option value="">{t('common.all')} {t('common.managers')}</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
              ))}
            </select>
          )}

          <select
            className={selectCls}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">{t('common.all')} {t('common.statuses')}</option>
            {(['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn'] as NegotiationStatus[]).map(
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
            {t('common.noResults')}
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.lastName')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.event')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.nationality')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.personalBest')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.seasonBest')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.worldRanking')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.scoring')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.recommendation')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.negotiation')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.participation')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.estimatedCost')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => {
                  const pb = app.waPerformance?.personalBest ?? app.personalBest
                  const sb = app.waPerformance?.seasonBest ?? app.seasonBest
                  const wr = app.waPerformance?.worldRanking ?? app.worldRanking
                  return (
                    <tr key={app.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5">
                        <Link
                          to={user?.role === 'committee' ? `/committee/athletes/${app.athleteId}` : `/collaborator/athletes/${app.athleteId}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {app.athlete.lastName}, {app.athlete.firstName}
                        </Link>
                        {app.athlete.managerId && (
                          <span className="ml-1 text-[10px] text-gray-400">MGR</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-600">{app.event.catalog.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs ${app.athlete.isSwiss ? 'text-red-600 font-semibold' : app.athlete.isEap ? 'text-blue-600 font-semibold' : 'text-gray-600'}`}>
                          {app.athlete.nationality}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">{pb ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{sb ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{wr ?? '—'}</td>
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
                            STATUS_COLORS[app.athlete.negotiationStatus as NegotiationStatus] ?? ''
                          }`}
                        >
                          {t(`status.${app.athlete.negotiationStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            app.participationStatus === 'selected'
                              ? 'bg-green-100 text-green-800'
                              : app.participationStatus === 'not_selected'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {t(`participation.${app.participationStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {app.athlete.estTotal > 0
                          ? `CHF ${app.athlete.estTotal.toLocaleString()}`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

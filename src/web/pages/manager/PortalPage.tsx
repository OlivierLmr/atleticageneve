import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { STATUS_COLORS, PARTICIPATION_COLORS, formatPerf } from '@web/lib/ui-constants'
import type { Application, Athlete, Event, Agreement, NegotiationStatus, ParticipationStatus, WaPerformance } from '@shared/types'

interface PortalEvent extends Event {
  name: string
  discipline: string
  gender: string
}

interface PortalApplication extends Application {
  event: PortalEvent | null
  waPerformance: WaPerformance | null
}

interface ManagerAthlete extends Athlete {
  applications: PortalApplication[]
  agreements: Agreement[]
}

interface ManagerPortalData {
  athletes: ManagerAthlete[]
  kpi: {
    total: number
    toReview: number
    inNegotiation: number
    confirmed: number
    rejected: number
    withdrawn: number
  }
}

export default function ManagerPortalPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ManagerPortalData>({
    queryKey: ['manager-portal'],
    queryFn: () => api.get('/api/v1/portal/manager'),
  })

  const respondMutation = useMutation({
    mutationFn: (params: { athleteId: string; action: string }) =>
      api.post(`/api/v1/portal/athlete/${params.athleteId}/respond`, { action: params.action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['manager-portal'] }),
  })

  const athletes = data?.athletes ?? []
  const kpi = data?.kpi ?? { total: 0, toReview: 0, inNegotiation: 0, confirmed: 0, rejected: 0, withdrawn: 0 }

  const filtered = statusFilter
    ? athletes.filter((a) => a.negotiationStatus === statusFilter)
    : athletes

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const selectCls = 'px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold">Atletica Genève</Link>
            <span className="text-xs text-gray-400">{t('manager.portal')}</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
                {user.organization ? ` — ${user.organization}` : ''}
              </span>
            )}
            {user && (
              <button onClick={() => logout()} className="text-xs text-gray-400 hover:text-gray-600">
                {t('auth.logout')}
              </button>
            )}
            <Link to="/manager/register" className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1">
              + {t('manager.addAthlete')}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* KPI cards */}
        <div className="grid grid-cols-6 gap-4 mb-6">
          {[
            { label: t('common.total'), value: kpi.total, color: 'text-gray-900' },
            { label: t('dashboard.toReview'), value: kpi.toReview, color: 'text-yellow-600' },
            { label: t('dashboard.inNegotiation'), value: kpi.inNegotiation, color: 'text-blue-600' },
            { label: t('dashboard.confirmed'), value: kpi.confirmed, color: 'text-green-600' },
            { label: t('status.rejected'), value: kpi.rejected, color: 'text-red-600' },
            { label: t('status.withdrawn'), value: kpi.withdrawn, color: 'text-gray-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">{t('common.all')} {t('common.statuses')}</option>
            {(['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn'] as NegotiationStatus[]).map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} {t('common.athletes')}</span>
        </div>

        {/* Athletes table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-400 text-sm mb-4">{t('manager.myAthletes')}: 0</p>
            <Link to="/manager/register" className="text-sm text-blue-600 underline">
              {t('manager.registerAthletes')}
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2.5 text-left font-medium w-6"></th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.lastName')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.event')}(s)</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.nationality')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.negotiation')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ath) => (
                  <>
                    <tr key={ath.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        {ath.applications.length > 0 && (
                          <button
                            onClick={() => setExpandedId(expandedId === ath.id ? null : ath.id)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            {expandedId === ath.id ? '▾' : '▸'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium">
                        <Link to={`/manager/athletes/${ath.id}`} className="hover:underline">
                          {ath.lastName}, {ath.firstName}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 text-xs">
                        {ath.applications.map(a => a.event?.name).filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{ath.nationality}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[ath.negotiationStatus]}`}>
                          {t(`status.${ath.negotiationStatus}`)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          {ath.negotiationStatus === 'agreement_sent' && (
                            <>
                              <button
                                onClick={() => respondMutation.mutate({ athleteId: ath.id, action: 'accept' })}
                                disabled={respondMutation.isPending}
                                className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                {t('contract.acceptOffer')}
                              </button>
                              <button
                                onClick={() => respondMutation.mutate({ athleteId: ath.id, action: 'reject' })}
                                disabled={respondMutation.isPending}
                                className="text-[10px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                {t('contract.declineOffer')}
                              </button>
                            </>
                          )}
                          {['agreement_sent', 'counter_offer_sent', 'confirmed'].includes(ath.negotiationStatus) && (
                            <button
                              onClick={() => {
                                if (confirm(t('confirm.withdrawAthlete', { athlete: `${ath.firstName} ${ath.lastName}` }))) {
                                  respondMutation.mutate({ athleteId: ath.id, action: 'withdraw' })
                                }
                              }}
                              disabled={respondMutation.isPending}
                              className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-red-600 disabled:opacity-50"
                            >
                              {t('contract.withdraw')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded row: per-event detail */}
                    {expandedId === ath.id && ath.applications.length > 0 && (
                      <tr key={`${ath.id}-detail`} className="border-b bg-gray-50/50">
                        <td colSpan={6} className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500">
                                <th className="py-1 text-left font-medium">{t('athlete.event')}</th>
                                <th className="py-1 text-right font-medium">{t('athlete.personalBest')}</th>
                                <th className="py-1 text-right font-medium">{t('athlete.seasonBest')}</th>
                                <th className="py-1 text-right font-medium">{t('athlete.worldRanking')}</th>
                                <th className="py-1 text-center font-medium">{t('selection.participation')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ath.applications.map((app) => (
                                <tr key={app.id} className="border-t border-gray-200">
                                  <td className="py-1.5 font-medium">{app.event?.name ?? '—'}</td>
                                  <td className="py-1.5 text-right">{formatPerf(app.waPerformance?.personalBest)}</td>
                                  <td className="py-1.5 text-right">{formatPerf(app.waPerformance?.seasonBest)}</td>
                                  <td className="py-1.5 text-right">{app.waPerformance?.worldRanking ?? '—'}</td>
                                  <td className="py-1.5 text-center">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PARTICIPATION_COLORS[app.participationStatus as ParticipationStatus]}`}>
                                      {t(`participation.${app.participationStatus}`)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {respondMutation.isError && (
          <p className="text-xs text-red-600 mt-2">{(respondMutation.error as Error)?.message || t('common.error')}</p>
        )}
      </div>
    </div>
  )
}

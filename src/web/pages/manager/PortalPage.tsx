import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import type { Application, Athlete, Event, ContractOffer, NegotiationStatus } from '@shared/types'

interface ManagerAthlete extends Athlete {
  applications: (Application & { event: Event | null })[]
  contracts: ContractOffer[]
  latestContract: ContractOffer | null
}

interface ManagerPortalData {
  athletes: ManagerAthlete[]
  kpi: {
    total: number
    toReview: number
    inNegotiation: number
    confirmed: number
    rejected: number
  }
}

const STATUS_COLORS: Record<NegotiationStatus, string> = {
  to_review: 'bg-yellow-100 text-yellow-800',
  contract_sent: 'bg-blue-100 text-blue-800',
  counter_offer: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export default function ManagerPortalPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')

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
  const kpi = data?.kpi ?? { total: 0, toReview: 0, inNegotiation: 0, confirmed: 0, rejected: 0 }

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
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[
            { label: t('common.total'), value: kpi.total, color: 'text-gray-900' },
            { label: t('dashboard.toReview'), value: kpi.toReview, color: 'text-yellow-600' },
            { label: t('dashboard.inNegotiation'), value: kpi.inNegotiation, color: 'text-blue-600' },
            { label: t('dashboard.confirmed'), value: kpi.confirmed, color: 'text-green-600' },
            { label: t('status.rejected'), value: kpi.rejected, color: 'text-red-600' },
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
            <option value="">{t('common.all')} statuses</option>
            {(['to_review', 'contract_sent', 'counter_offer', 'accepted', 'rejected', 'withdrawn'] as NegotiationStatus[]).map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} athletes</span>
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
                  <th className="px-3 py-2.5 text-left font-medium">Athlete</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.event')}(s)</th>
                  <th className="px-3 py-2.5 text-left font-medium">NAT</th>
                  <th className="px-3 py-2.5 text-left font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ath) => (
                  <tr key={ath.id} className="border-b hover:bg-gray-50">
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
                        {ath.negotiationStatus === 'contract_sent' && (
                          <>
                            <button
                              onClick={() => respondMutation.mutate({ athleteId: ath.id, action: 'accept' })}
                              disabled={respondMutation.isPending}
                              className="text-[10px] px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => respondMutation.mutate({ athleteId: ath.id, action: 'reject' })}
                              disabled={respondMutation.isPending}
                              className="text-[10px] px-2 py-0.5 rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {['to_review', 'contract_sent', 'counter_offer', 'accepted'].includes(ath.negotiationStatus) && (
                          <button
                            onClick={() => {
                              if (confirm(`Withdraw ${ath.firstName} ${ath.lastName}?`)) {
                                respondMutation.mutate({ athleteId: ath.id, action: 'withdraw' })
                              }
                            }}
                            disabled={respondMutation.isPending}
                            className="text-[10px] px-2 py-0.5 rounded border border-gray-200 text-gray-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Withdraw
                          </button>
                        )}
                      </div>
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

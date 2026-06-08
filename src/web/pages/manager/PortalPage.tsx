import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { STATUS_COLORS, formatPerf } from '@web/lib/ui-constants'
import type { Application, Athlete, Event, NegotiationStatus, WaPerformance, User } from '@shared/types'

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
  const [editingIban, setEditingIban] = useState(false)
  const [ibanDraft, setIbanDraft] = useState('')
  const [ibanSaved, setIbanSaved] = useState(false)

  const { data, isLoading } = useQuery<ManagerPortalData>({
    queryKey: ['manager-portal'],
    queryFn: () => api.get('/api/v1/portal/manager'),
  })

  const { data: profile } = useQuery<User>({
    queryKey: ['user-profile'],
    queryFn: () => api.get('/api/v1/users/me'),
  })

  const ibanMutation = useMutation({
    mutationFn: (bankIban: string | null) => api.patch('/api/v1/users/me', { bankIban }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      setEditingIban(false)
      setIbanSaved(true)
      setTimeout(() => setIbanSaved(false), 3000)
    },
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

        {/* IBAN section */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-sm font-semibold mb-0.5">{t('payments.ibanSection')}</h2>
              <p className="text-xs text-gray-400 mb-3">{t('payments.ibanHint')}</p>
              {editingIban ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ibanDraft}
                    onChange={e => setIbanDraft(e.target.value)}
                    placeholder={t('payments.ibanPlaceholder')}
                    className="flex-1 max-w-xs px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    autoFocus
                  />
                  <button
                    onClick={() => ibanMutation.mutate(ibanDraft.trim() || null)}
                    disabled={ibanMutation.isPending}
                    className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
                  >
                    {t('common.save')}
                  </button>
                  <button
                    onClick={() => setEditingIban(false)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {profile?.bankIban ? (
                    <span className="font-mono text-sm text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">
                      {profile.bankIban}
                    </span>
                  ) : (
                    <span className="text-sm text-amber-600 font-medium">{t('payments.ibanMissing')}</span>
                  )}
                  <button
                    onClick={() => { setIbanDraft(profile?.bankIban ?? ''); setEditingIban(true) }}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1"
                  >
                    {t('common.edit')}
                  </button>
                  {ibanSaved && (
                    <span className="text-xs text-green-600">{t('payments.ibanSaved')}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            className="px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
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
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.lastName')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.event')}(s)</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('athlete.nationality')}</th>
                  <th className="px-3 py-2.5 text-left font-medium">SB</th>
                  <th className="px-3 py-2.5 text-left font-medium">{t('selection.negotiation')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ath) => (
                  <tr key={ath.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium">
                      <Link to={`/manager/athletes/${ath.id}`} className="hover:underline text-blue-600">
                        {ath.lastName}, {ath.firstName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 text-xs">
                      {ath.applications.map(a => a.event?.name).filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{ath.nationality}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">
                      {ath.applications.map(a => formatPerf(a.waPerformance?.seasonBest, a.event?.discipline)).join(' / ') || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[ath.negotiationStatus]}`}>
                        {t(`status.${ath.negotiationStatus}`)}
                      </span>
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

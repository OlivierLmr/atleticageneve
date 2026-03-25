import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'

interface EventStat {
  eventId: string
  eventName: string
  gender: string
  maxSlots: number
  confirmed: number
  negotiating: number
  toReview: number
  total: number
  fillRate: number
  swissQuota: number
  swissConfirmed: number
  eapQuota: number
  eapConfirmed: number
  budget: number
}

interface SelectorStat {
  selectorId: string
  name: string
  total: number
  toReview: number
  inNegotiation: number
  confirmed: number
}

interface DashboardData {
  edition: {
    name: string
    year: number
    startDate: string
    endDate: string
    totalBudget: number
  }
  kpi: {
    totalApplications: number
    confirmed: number
    inNegotiation: number
    toReview: number
    rejected: number
    withdrawn: number
    budgetCommitted: number
    budgetInNegotiation: number
    budgetRemaining: number
  }
  events: EventStat[]
  selectors: SelectorStat[]
  costBreakdown: {
    travel: number
    accommodation: number
    appearance: number
    total: number
  }
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/v1/dashboard'),
  })

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const { kpi, events, selectors, costBreakdown, edition } = data
  const budgetUsedPct = edition.totalBudget > 0 ? (kpi.budgetCommitted / edition.totalBudget) * 100 : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold">Atletica Genève</Link>
            <span className="text-xs text-gray-400">
              {t('dashboard.title')} — {edition.name} {edition.year}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
              </span>
            )}
            {user && (
              <button onClick={() => logout()} className="text-xs text-gray-400 hover:text-gray-600">
                {t('auth.logout')}
              </button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-6 gap-4">
          <KpiCard label={t('dashboard.confirmed')} value={kpi.confirmed} color="text-green-600" />
          <KpiCard label={t('dashboard.inNegotiation')} value={kpi.inNegotiation} color="text-blue-600" />
          <KpiCard label={t('dashboard.toReview')} value={kpi.toReview} color="text-yellow-600" />
          <KpiCard
            label={t('dashboard.budgetCommitted')}
            value={`CHF ${kpi.budgetCommitted.toLocaleString()}`}
            sub={`${budgetUsedPct.toFixed(0)}%`}
            color="text-gray-900"
          />
          <KpiCard
            label={t('dashboard.budgetRemaining')}
            value={`CHF ${kpi.budgetRemaining.toLocaleString()}`}
            color={kpi.budgetRemaining > 0 ? 'text-green-600' : 'text-red-600'}
          />
          <KpiCard label={t('dashboard.applicationPipeline')} value={kpi.totalApplications} color="text-gray-600" />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Event coverage table */}
          <div className="col-span-2 bg-white rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-sm">{t('dashboard.eventCoverage')}</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">{t('athlete.event')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.fillRate')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.confirmed')}</th>
                  <th className="px-3 py-2 text-center font-medium">Neg.</th>
                  <th className="px-3 py-2 text-center font-medium">Rev.</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.swissQuota')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.eapQuota')}</th>
                  <th className="px-3 py-2 text-right font-medium">Budget</th>
                </tr>
              </thead>
              <tbody>
                {events.map((evt) => (
                  <tr key={evt.eventId} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{evt.eventName}</td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              evt.fillRate >= 1
                                ? 'bg-green-500'
                                : evt.fillRate >= 0.5
                                ? 'bg-blue-500'
                                : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(100, evt.fillRate * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">
                          {evt.confirmed}/{evt.maxSlots}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-green-600">
                      {evt.confirmed}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-blue-600">
                      {evt.negotiating}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-yellow-600">
                      {evt.toReview}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <QuotaBadge filled={evt.swissConfirmed} quota={evt.swissQuota} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <QuotaBadge filled={evt.eapConfirmed} quota={evt.eapQuota} />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {evt.budget > 0 ? `CHF ${evt.budget.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Cost breakdown */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('dashboard.costBreakdown')}</h3>
              <div className="space-y-2">
                <CostRow label="Appearance fees" value={costBreakdown.appearance} total={costBreakdown.total} />
                <CostRow label="Travel" value={costBreakdown.travel} total={costBreakdown.total} />
                <CostRow label="Accommodation & Catering" value={costBreakdown.accommodation} total={costBreakdown.total} />
                <div className="flex justify-between pt-2 border-t font-semibold text-sm">
                  <span>{t('common.total')}</span>
                  <span>CHF {costBreakdown.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Selector workload */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('dashboard.selectors')}</h3>
              {selectors.length === 0 ? (
                <p className="text-xs text-gray-400">No selectors assigned</p>
              ) : (
                <div className="space-y-2">
                  {selectors.map((s) => (
                    <div key={s.selectorId} className="flex items-center justify-between text-xs">
                      <span className="font-medium">{s.name}</span>
                      <div className="flex gap-2">
                        <span className="text-yellow-600">{s.toReview} rev</span>
                        <span className="text-blue-600">{s.inNegotiation} neg</span>
                        <span className="text-green-600">{s.confirmed} conf</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pipeline summary */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('dashboard.applicationPipeline')}</h3>
              <div className="space-y-1.5">
                {[
                  { label: t('dashboard.toReview'), value: kpi.toReview, color: 'bg-yellow-500' },
                  { label: t('dashboard.inNegotiation'), value: kpi.inNegotiation, color: 'bg-blue-500' },
                  { label: t('dashboard.confirmed'), value: kpi.confirmed, color: 'bg-green-500' },
                  { label: t('status.rejected'), value: kpi.rejected, color: 'bg-red-400' },
                  { label: t('status.withdrawn'), value: kpi.withdrawn, color: 'bg-gray-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${color}`} />
                    <span className="text-xs text-gray-600 flex-1">{label}</span>
                    <span className="text-xs font-mono font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  color: string
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        {sub && <span className="text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  )
}

function QuotaBadge({ filled, quota }: { filled: number; quota: number }) {
  const met = filled >= quota
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
        met ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
      }`}
    >
      {filled}/{quota}
    </span>
  )
}

function CostRow({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-600 flex-1">{label}</span>
      <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-gray-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono w-20 text-right">CHF {value.toLocaleString()}</span>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'

interface EventStat {
  eventId: string
  eventName: string
  discipline: string
  gender: string
  maxSlots: number
  confirmedSelected: number
  inNegotiationSelected: number
  confirmedFillRate: number
  negotiationFillRate: number
  swissQuota: number
  swissSelected: number
  eapQuota: number
  eapSelected: number
}

interface HotelRoomStat {
  roomId: string
  hotelId: string
  roomType: string
  reservedRooms: number
  confirmedOccupancy: number
  negotiationOccupancy: number
  confirmedCount: number
  inNegotiationCount: number
}

interface SelectorStat {
  selectorId: string
  name: string
  total: number
  toReview: number
  inNegotiation: number
  confirmed: number
  rejected: number
  withdrawn: number
}

interface DashboardData {
  edition: {
    name: string
    year: number
    startDate: string
    endDate: string
    totalBudget: number
    currency: string
  }
  kpi: {
    totalAthletes: number
    totalApplications: number
    confirmed: number
    inNegotiation: number
    toReview: number
    rejected: number
    withdrawn: number
    budgetCommitted: number
    budgetInNegotiation: number
    budgetRemaining: number
    totalPrizeMoney: number
  }
  events: EventStat[]
  hotelRooms: HotelRoomStat[]
  selectors: SelectorStat[]
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()

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

  const { kpi, events, selectors, edition } = data
  const cur = edition.currency || 'CHF'
  const budgetUsedPct = edition.totalBudget > 0 ? (kpi.budgetCommitted / edition.totalBudget) * 100 : 0

  return (
    <div>
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Edition header */}
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-lg font-bold">{edition.name} {edition.year}</h1>
            <p className="text-xs text-gray-400">
              {edition.startDate} — {edition.endDate} · {cur} · {t('dashboard.totalBudget')}: {cur} {edition.totalBudget.toLocaleString()}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label={t('dashboard.confirmed')} value={kpi.confirmed} color="text-green-600" />
          <KpiCard label={t('dashboard.inNegotiation')} value={kpi.inNegotiation} color="text-blue-600" />
          <KpiCard label={t('dashboard.toReview')} value={kpi.toReview} color="text-yellow-600" />
          <KpiCard label="Athletes" value={kpi.totalAthletes} color="text-gray-600" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          <KpiCard
            label={t('dashboard.budgetCommitted')}
            value={`${cur} ${kpi.budgetCommitted.toLocaleString()}`}
            sub={`${budgetUsedPct.toFixed(0)}%`}
            color="text-gray-900"
          />
          <KpiCard
            label={t('dashboard.budgetInNegotiation')}
            value={`${cur} ${kpi.budgetInNegotiation.toLocaleString()}`}
            color="text-blue-600"
          />
          <KpiCard
            label={t('dashboard.budgetRemaining')}
            value={`${cur} ${kpi.budgetRemaining.toLocaleString()}`}
            color={kpi.budgetRemaining > 0 ? 'text-green-600' : 'text-red-600'}
          />
          <KpiCard
            label={t('dashboard.totalPrizeMoney')}
            value={`${cur} ${kpi.totalPrizeMoney.toLocaleString()}`}
            color="text-purple-600"
          />
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
                  <th className="px-3 py-2 text-center font-medium">Confirmed</th>
                  <th className="px-3 py-2 text-center font-medium">In Neg.</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.swissQuota')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('dashboard.eapQuota')}</th>
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
                              evt.confirmedFillRate >= 1
                                ? 'bg-green-500'
                                : evt.confirmedFillRate >= 0.5
                                ? 'bg-blue-500'
                                : 'bg-yellow-500'
                            }`}
                            style={{ width: `${Math.min(100, evt.confirmedFillRate * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono">
                          {evt.confirmedSelected}/{evt.maxSlots}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-green-600">
                      {evt.confirmedSelected}
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs text-blue-600">
                      {evt.inNegotiationSelected}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <QuotaBadge filled={evt.swissSelected} quota={evt.swissQuota} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <QuotaBadge filled={evt.eapSelected} quota={evt.eapQuota} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right column */}
          <div className="space-y-4">
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

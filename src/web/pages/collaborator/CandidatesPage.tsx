import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { STATUS_COLORS, PARTICIPATION_COLORS, formatPerf } from '@web/lib/ui-constants'
import { PARTICIPATION_TRANSITIONS } from '@shared/constants'
import { ScoringPopup, CostPopup } from './athlete/BannerEventRow'
import type { Application, Athlete, Agreement, AthleteDetail, ApplicationForAthlete, Event, EventCatalog, NegotiationStatus, ParticipationStatus, WaPerformance, EditionCosts, Edition } from '@shared/types'

interface ApplicationRow extends Application {
  athlete: Athlete
  event: Event & { catalog: EventCatalog }
  waPerformance: WaPerformance | null
  latestAgreement: Agreement | null
}

interface EventListItem extends Event {
  name: string
  discipline: string
  gender: string
  perfType: string
}

const REC_COLORS: Record<string, string> = {
  'Highly Recommended': 'bg-green-100 text-green-800',
  'Recommended': 'bg-blue-100 text-blue-700',
  'Under Review': 'bg-yellow-100 text-yellow-800',
  'Not Recommended': 'bg-red-100 text-red-800',
}

const REC_ORDER: Record<string, number> = {
  'Highly Recommended': 0,
  'Recommended': 1,
  'Under Review': 2,
  'Not Recommended': 3,
}

const NEGOTIATION_ORDER: Record<NegotiationStatus, number> = {
  confirmed: 0,
  agreement_sent: 1,
  counter_offer_sent: 2,
  to_review: 3,
  rejected: 4,
  withdrawn: 5,
}

const PARTICIPATION_ORDER: Record<ParticipationStatus, number> = {
  selected: 0,
  pending: 1,
  not_selected: 2,
}

type SortCol =
  | 'name'
  | 'nationality'
  | 'negotiationStatus'
  | 'cost'
  | 'event'
  | 'personalBest'
  | 'seasonBest'
  | 'worldRanking'
  | 'score'
  | 'recommendation'
  | 'participationStatus'

interface StatusModal {
  appId: string
  athleteName: string
  eventName: string
  currentStatus: ParticipationStatus
  pendingNew: ParticipationStatus | null
}

const ALL_STATUSES: NegotiationStatus[] = ['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed', 'rejected', 'withdrawn']
const DEFAULT_STATUSES = new Set<NegotiationStatus>(['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed'])

function seasonBestColor(app: ApplicationRow, sb: number | null): string {
  if (sb == null) return ''
  const perfType = app.event.catalog.discipline === 'Course' ? 'MIN' : 'MAX'
  const threshold =
    app.athlete.isEap && app.event.eapMinima != null
      ? app.event.eapMinima
      : app.athlete.isSwiss
      ? app.event.swissMinima
      : app.event.intMinima
  const eligible = perfType === 'MIN' ? sb <= threshold : sb >= threshold
  return eligible ? 'text-green-600 font-semibold' : 'text-red-600'
}

function MinimaRow({ label, value, discipline }: { label: string; value: number | null | undefined; discipline: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-mono font-semibold text-gray-900">
        {value != null ? formatPerf(value, discipline) : 'N/A'}
      </span>
    </div>
  )
}

function SlotBar({
  total,
  confirmed,
  underNegotiation,
  available,
}: {
  total: number
  confirmed: number
  underNegotiation: number
  available: number
}) {
  const { t } = useTranslation()
  const confirmedPct = total > 0 ? (confirmed / total) * 100 : 0
  const negotiationPct = total > 0 ? (underNegotiation / total) * 100 : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex h-4 flex-1 rounded-full overflow-hidden bg-gray-100">
          <div
            className="bg-green-500 transition-all duration-300"
            style={{ width: `${confirmedPct}%` }}
          />
          <div
            className="bg-blue-400 transition-all duration-300"
            style={{ width: `${negotiationPct}%` }}
          />
        </div>
        <span className="text-xs font-bold text-gray-700 w-5 text-right shrink-0">{total}</span>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-green-500 shrink-0" />
          {confirmed} {t('status.confirmed').toLowerCase()}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-blue-400 shrink-0" />
          {underNegotiation} {t('dashboard.inNegotiation').toLowerCase()}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-gray-100 border border-gray-300 shrink-0" />
          {available} {t('selection.available').toLowerCase()}
        </span>
      </div>
    </div>
  )
}

function EventInfoPanel({
  event,
  applications,
}: {
  event: EventListItem
  applications: ApplicationRow[]
}) {
  const { t } = useTranslation()

  const selectedApps = applications.filter((a) => a.participationStatus === 'selected')

  const confirmed = selectedApps.filter((a) => a.athlete.negotiationStatus === 'confirmed').length
  const underNegotiation = selectedApps.filter(
    (a) =>
      a.athlete.negotiationStatus === 'agreement_sent' ||
      a.athlete.negotiationStatus === 'counter_offer_sent'
  ).length
  const available = Math.max(0, event.maxSlots - confirmed - underNegotiation)

  const swissApps = selectedApps.filter((a) => a.athlete.isSwiss)
  const swissConfirmed = swissApps.filter((a) => a.athlete.negotiationStatus === 'confirmed').length
  const swissNegotiation = swissApps.filter(
    (a) =>
      a.athlete.negotiationStatus === 'agreement_sent' ||
      a.athlete.negotiationStatus === 'counter_offer_sent'
  ).length
  const swissAvailable = Math.max(0, event.swissQuota - swissConfirmed - swissNegotiation)

  const eapApps = selectedApps.filter((a) => a.athlete.isEap)
  const eapConfirmed = eapApps.filter((a) => a.athlete.negotiationStatus === 'confirmed').length
  const eapNegotiation = eapApps.filter(
    (a) =>
      a.athlete.negotiationStatus === 'agreement_sent' ||
      a.athlete.negotiationStatus === 'counter_offer_sent'
  ).length
  const eapAvailable = Math.max(0, event.eapQuota - eapConfirmed - eapNegotiation)

  return (
    <div className="bg-white rounded-lg border p-4 mb-4">
      <div className="flex gap-6 flex-wrap items-start">
        <div className="min-w-[160px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {t('selection.minima')}
          </p>
          <div className="space-y-1.5">
            <MinimaRow label={t('selection.international')} value={event.intMinima} discipline={event.discipline} />
            <MinimaRow label={t('selection.swiss')} value={event.swissMinima} discipline={event.discipline} />
            <MinimaRow label={t('selection.eap')} value={event.eapMinima} discipline={event.discipline} />
          </div>
        </div>

        <div className="w-px self-stretch bg-gray-100" />

        <div className="flex-1 min-w-[240px]">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {t('selection.slots')}
          </p>
          <SlotBar
            total={event.maxSlots}
            confirmed={confirmed}
            underNegotiation={underNegotiation}
            available={available}
          />
        </div>

        {event.swissQuota > 0 && (
          <>
            <div className="w-px self-stretch bg-gray-100" />
            <div className="min-w-[180px]">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('dashboard.swissQuota')}
              </p>
              <SlotBar
                total={event.swissQuota}
                confirmed={swissConfirmed}
                underNegotiation={swissNegotiation}
                available={swissAvailable}
              />
            </div>
          </>
        )}

        {event.eapQuota > 0 && (
          <>
            <div className="w-px self-stretch bg-gray-100" />
            <div className="min-w-[180px]">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                {t('dashboard.eapQuota')}
              </p>
              <SlotBar
                total={event.eapQuota}
                confirmed={eapConfirmed}
                underNegotiation={eapNegotiation}
                available={eapAvailable}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── CandidateRow ─────────────────────────────────────────────────────────────

function CandidateRow({
  app,
  edition,
  allRooms,
  onStatusClick,
  userRole,
}: {
  app: ApplicationRow
  edition: EditionCosts | null
  allRooms: { id: string; costPerNight: number; dinnerCost: number }[]
  onStatusClick: (app: ApplicationRow) => void
  userRole: string | undefined
}) {
  const { t } = useTranslation()
  const costBtnRef = useRef<HTMLButtonElement>(null)
  const scoreBtnRef = useRef<HTMLButtonElement>(null)
  const [costRect, setCostRect] = useState<DOMRect | null>(null)
  const [scoreRect, setScoreRect] = useState<DOMRect | null>(null)

  const pb = app.waPerformance?.personalBest ?? app.personalBest
  const sb = app.waPerformance?.seasonBest ?? app.seasonBest
  const wr = app.waPerformance?.worldRanking ?? app.worldRanking
  const sbColor = seasonBestColor(app, sb)
  const allowedTransitions = PARTICIPATION_TRANSITIONS[app.participationStatus] ?? []
  const canChangeStatus = allowedTransitions.length > 0

  const costMode =
    app.athlete.negotiationStatus === 'confirmed' ? 'confirmed' :
    ['agreement_sent', 'counter_offer_sent'].includes(app.athlete.negotiationStatus) ? 'negotiating' :
    'estimated'

  const latestOfferCost = app.latestAgreement?.totalCost ?? null
  const hasOffer = ['agreement_sent', 'counter_offer_sent', 'confirmed'].includes(app.athlete.negotiationStatus)

  // AthleteDetail-compatible object for the popups (edition is supplied externally)
  const athleteDetail = {
    ...app.athlete,
    edition,
    managerName: null,
    applications: [] as ApplicationForAthlete[],
    agreements: [] as Agreement[],
    interactions: [],
  } as AthleteDetail

  const appForScoring = app as ApplicationForAthlete

  return (
    <tr className="border-b hover:bg-gray-50 transition-colors">
      {/* Name */}
      <td className="px-3 py-2.5">
        <Link
          to={
            userRole === 'committee'
              ? `/committee/athletes/${app.athleteId}`
              : `/collaborator/athletes/${app.athleteId}`
          }
          className="font-medium text-gray-900 hover:underline"
        >
          {app.athlete.lastName}, {app.athlete.firstName}
        </Link>
        {app.athlete.managerId && (
          <span className="ml-1 text-[10px] text-gray-400">MGR</span>
        )}
        {app.athlete.isEap && (
          <span className="ml-1 text-[10px] text-gray-400">EAP</span>
        )}
      </td>

      {/* Nationality */}
      <td className="px-3 py-2.5">
        <span
          className={`text-xs ${
            app.athlete.isSwiss
              ? 'text-red-600 font-semibold'
              : app.athlete.isEap
              ? 'text-blue-600 font-semibold'
              : 'text-gray-600'
          }`}
        >
          {app.athlete.nationality}
        </span>
      </td>

      {/* Negotiation status */}
      <td className="px-3 py-2.5">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            STATUS_COLORS[app.athlete.negotiationStatus as NegotiationStatus] ?? ''
          }`}
        >
          {t(`status.${app.athlete.negotiationStatus}`)}
        </span>
      </td>

      {/* Cost with hover popup */}
      <td className="px-3 py-2.5 font-mono text-xs">
        <button
          ref={costBtnRef}
          className="text-left hover:text-blue-700 cursor-default"
          onMouseEnter={() => { if (costBtnRef.current) setCostRect(costBtnRef.current.getBoundingClientRect()) }}
          onMouseLeave={() => setCostRect(null)}
        >
          {hasOffer && latestOfferCost != null ? (
            `CHF ${latestOfferCost.toLocaleString()}`
          ) : app.athlete.estTotal > 0 ? (
            <span className="text-gray-400">CHF {app.athlete.estTotal.toLocaleString()}</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </button>
        {costRect && createPortal(
          <CostPopup
            athlete={athleteDetail}
            latestAgreement={app.latestAgreement ?? undefined}
            costMode={costMode}
            allRooms={allRooms}
            t={t}
            style={{ position: 'fixed', top: costRect.bottom + 4, left: Math.max(0, costRect.right - 256), zIndex: 9999 }}
          />,
          document.body
        )}
      </td>

      {/* Event */}
      <td className="px-3 py-2.5 text-gray-600">{app.event.catalog.name}</td>

      {/* Personal best */}
      <td className="px-3 py-2.5 font-mono text-xs text-gray-700">
        {formatPerf(pb, app.event.catalog.discipline)}
      </td>

      {/* Season best */}
      <td className={`px-3 py-2.5 font-mono text-xs ${sbColor}`}>
        {formatPerf(sb, app.event.catalog.discipline)}
      </td>

      {/* World ranking */}
      <td className="px-3 py-2.5 font-mono text-xs text-gray-700">{wr ?? '—'}</td>

      {/* Scoring with hover popup */}
      <td className="px-3 py-2.5">
        {app.score != null ? (
          <>
            <button
              ref={scoreBtnRef}
              className="font-mono text-xs font-medium hover:text-blue-700 cursor-default"
              onMouseEnter={() => { if (scoreBtnRef.current) setScoreRect(scoreBtnRef.current.getBoundingClientRect()) }}
              onMouseLeave={() => setScoreRect(null)}
            >
              {(app.score * 100).toFixed(0)}
            </button>
            {scoreRect && edition && createPortal(
              <ScoringPopup
                app={appForScoring}
                athlete={athleteDetail}
                edition={edition}
                t={t}
                style={{ position: 'fixed', top: scoreRect.bottom + 4, left: scoreRect.left, zIndex: 9999 }}
              />,
              document.body
            )}
          </>
        ) : (
          '—'
        )}
      </td>

      {/* Recommendation */}
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

      {/* Selection status — clickable */}
      <td className="px-3 py-2.5">
        <button
          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            PARTICIPATION_COLORS[app.participationStatus]
          } ${canChangeStatus ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          disabled={!canChangeStatus}
          onClick={() => {
            if (!canChangeStatus) return
            onStatusClick(app)
          }}
        >
          {t(`participation.${app.participationStatus}`)}
        </button>
      </td>
    </tr>
  )
}

// ── CandidatesPage ────────────────────────────────────────────────────────────

export default function CandidatesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null)

  // Filter state derived from URL search params
  const eventFilter = searchParams.get('event') ?? ''
  const managerFilter = searchParams.get('manager') ?? ''
  const search = searchParams.get('search') ?? ''
  const sortCol = (searchParams.get('sort') as SortCol) ?? 'name'
  const sortDir = (searchParams.get('dir') as 'asc' | 'desc') ?? 'asc'
  const statusFilters = useMemo(() => {
    const raw = searchParams.get('statuses')
    if (!raw) return DEFAULT_STATUSES
    return new Set(raw.split(',') as NegotiationStatus[])
  }, [searchParams])

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true }
    )
  }

  const toggleStatus = (s: NegotiationStatus) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const raw = prev.get('statuses')
        const current = new Set(
          raw ? (raw.split(',') as NegotiationStatus[]) : [...DEFAULT_STATUSES]
        )
        if (current.has(s)) current.delete(s)
        else current.add(s)
        const arr = [...current]
        next.set('statuses', arr.join(','))
        return next
      },
      { replace: true }
    )
  }

  const handleSort = (col: SortCol) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if ((prev.get('sort') ?? 'name') === col) {
          next.set('dir', (prev.get('dir') ?? 'asc') === 'asc' ? 'desc' : 'asc')
        } else {
          next.set('sort', col)
          next.delete('dir')
        }
        return next
      },
      { replace: true }
    )
  }

  const setEventFilter = (v: string) => updateParam('event', v)
  const setManagerFilter = (v: string) => updateParam('manager', v)
  const setSearch = (v: string) => updateParam('search', v)

  const { data: applications = [], isLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['applications', eventFilter, managerFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (eventFilter) params.set('eventId', eventFilter)
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

  const { data: editionRaw } = useQuery<Edition>({
    queryKey: ['edition'],
    queryFn: () => api.get('/api/v1/editions/current'),
  })

  const edition: EditionCosts | null = editionRaw ?? null

  const { data: allRooms = [] } = useQuery<{ id: string; costPerNight: number; dinnerCost: number }[]>({
    queryKey: ['hotel-rooms'],
    queryFn: () => api.get('/api/v1/hotel-rooms'),
  })

  const statusChangeMutation = useMutation({
    mutationFn: ({ appId, newStatus }: { appId: string; newStatus: ParticipationStatus }) =>
      api.patch(`/api/v1/applications/${appId}/participation-status`, {
        participationStatus: newStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] })
      setStatusModal(null)
    },
  })

  const getSortValue = (app: ApplicationRow): string | number => {
    const pb = app.waPerformance?.personalBest ?? app.personalBest
    const sb = app.waPerformance?.seasonBest ?? app.seasonBest
    const wr = app.waPerformance?.worldRanking ?? app.worldRanking
    switch (sortCol) {
      case 'name':
        return `${app.athlete.lastName} ${app.athlete.firstName}`.toLowerCase()
      case 'nationality':
        return app.athlete.nationality.toLowerCase()
      case 'negotiationStatus':
        return NEGOTIATION_ORDER[app.athlete.negotiationStatus] ?? 99
      case 'cost': {
        const hasOffer = ['agreement_sent', 'counter_offer_sent', 'confirmed'].includes(app.athlete.negotiationStatus)
        return hasOffer && app.latestAgreement?.totalCost != null ? app.latestAgreement.totalCost : app.athlete.estTotal
      }
      case 'event':
        return app.event.catalog.name.toLowerCase()
      case 'personalBest':
        return pb ?? Infinity
      case 'seasonBest':
        return sb ?? Infinity
      case 'worldRanking':
        return wr ?? Infinity
      case 'score':
        return app.score ?? -1
      case 'recommendation':
        return REC_ORDER[app.recommendation ?? ''] ?? 99
      case 'participationStatus':
        return PARTICIPATION_ORDER[app.participationStatus] ?? 99
      default:
        return 0
    }
  }

  const filtered = useMemo(() => {
    const list = applications.filter((a) => {
      if (!statusFilters.has(a.athlete.negotiationStatus)) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          a.athlete.firstName.toLowerCase().includes(q) ||
          a.athlete.lastName.toLowerCase().includes(q)
        )
      }
      return true
    })

    return list.sort((a, b) => {
      const va = getSortValue(a)
      const vb = getSortValue(b)
      let cmp = 0
      if (typeof va === 'string' && typeof vb === 'string') {
        cmp = va.localeCompare(vb)
      } else if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [applications, statusFilters, search, sortCol, sortDir])

  const stats = {
    total: applications.length,
    toReview: applications.filter((a) => a.athlete.negotiationStatus === 'to_review').length,
    inNegotiation: applications.filter((a) =>
      ['agreement_sent', 'counter_offer_sent'].includes(a.athlete.negotiationStatus)
    ).length,
    confirmed: applications.filter((a) => a.athlete.negotiationStatus === 'confirmed').length,
  }

  const selectedEvent = eventFilter ? (events.find((e) => e.id === eventFilter) ?? null) : null

  const selectCls =
    'px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900'

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? (
      <span className="text-gray-500 ml-0.5">{sortDir === 'asc' ? '↑' : '↓'}</span>
    ) : (
      <span className="text-gray-300 ml-0.5">↕</span>
    )

  const Th = ({ col, label }: { col: SortCol; label: string }) => (
    <th
      className="px-3 py-2.5 text-left font-medium cursor-pointer hover:bg-gray-100 select-none whitespace-nowrap"
      onClick={() => handleSort(col)}
    >
      {label}
      <SortIcon col={col} />
    </th>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold">{t('selection.title')}</span>
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
            { label: t('dashboard.inNegotiation'), value: stats.inNegotiation, color: 'text-blue-600' },
            { label: t('dashboard.confirmed'), value: stats.confirmed, color: 'text-green-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center flex-wrap gap-3 mb-4">
          <select
            className={selectCls}
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="">
              {t('common.all')} {t('athlete.event')}s
            </option>
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
              <option value="">
                {t('common.all')} {t('common.managers')}
              </option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.firstName} {m.lastName}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {ALL_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={statusFilters.has(s)}
                  onChange={() => toggleStatus(s)}
                  className="rounded border-gray-300 text-gray-900 focus:ring-gray-900 w-3.5 h-3.5"
                />
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[s]}`}>
                  {t(`status.${s}`)}
                </span>
              </label>
            ))}
          </div>

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

        {/* Event info panel */}
        {selectedEvent && (
          <EventInfoPanel event={selectedEvent} applications={applications} />
        )}

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
                  <Th col="name" label={t('athlete.lastName')} />
                  <Th col="nationality" label={t('athlete.nationality')} />
                  <Th col="negotiationStatus" label={t('selection.negotiation')} />
                  <Th col="cost" label={t('selection.cost')} />
                  <Th col="event" label={t('athlete.event')} />
                  <Th col="personalBest" label={t('athlete.personalBest')} />
                  <Th col="seasonBest" label={t('athlete.seasonBest')} />
                  <Th col="worldRanking" label={t('athlete.worldRanking')} />
                  <Th col="score" label={t('selection.scoring')} />
                  <Th col="recommendation" label={t('selection.recommendation')} />
                  <Th col="participationStatus" label={t('selection.selectionStatus')} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((app) => (
                  <CandidateRow
                    key={app.id}
                    app={app}
                    edition={edition}
                    allRooms={allRooms}
                    onStatusClick={(a) =>
                      setStatusModal({
                        appId: a.id,
                        athleteName: `${a.athlete.lastName}, ${a.athlete.firstName}`,
                        eventName: a.event.catalog.name,
                        currentStatus: a.participationStatus,
                        pendingNew: null,
                      })
                    }
                    userRole={user?.role}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Selection status change modal */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              {t('selection.changeSelectionStatus')}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {statusModal.athleteName} — {statusModal.eventName}
            </p>

            {statusModal.pendingNew === null ? (
              /* Step 1: choose new status */
              <>
                <p className="text-xs text-gray-600 mb-3">
                  {t('common.current')}:{' '}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PARTICIPATION_COLORS[statusModal.currentStatus]}`}
                  >
                    {t(`participation.${statusModal.currentStatus}`)}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(PARTICIPATION_TRANSITIONS[statusModal.currentStatus] ?? []).map((next) => (
                    <button
                      key={next}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-medium border-2 ${PARTICIPATION_COLORS[next]} border-transparent hover:opacity-90`}
                      onClick={() =>
                        setStatusModal((prev) => prev && { ...prev, pendingNew: next })
                      }
                    >
                      {t(`participation.${next}`)}
                    </button>
                  ))}
                </div>
                <button
                  className="w-full text-xs text-gray-500 hover:text-gray-700 py-1"
                  onClick={() => setStatusModal(null)}
                >
                  {t('common.cancel')}
                </button>
              </>
            ) : (
              /* Step 2: confirm */
              <>
                <p className="text-xs text-gray-700 mb-4">
                  {t('selection.confirmStatusChangeTo')}{' '}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PARTICIPATION_COLORS[statusModal.pendingNew]}`}
                  >
                    {t(`participation.${statusModal.pendingNew}`)}
                  </span>{' '}
                  ?
                </p>
                <div className="flex gap-2">
                  <button
                    className="flex-1 text-xs bg-gray-900 text-white rounded-lg py-2 hover:bg-gray-700 disabled:opacity-50"
                    disabled={statusChangeMutation.isPending}
                    onClick={() => {
                      if (statusModal.pendingNew) {
                        statusChangeMutation.mutate({
                          appId: statusModal.appId,
                          newStatus: statusModal.pendingNew,
                        })
                      }
                    }}
                  >
                    {statusChangeMutation.isPending ? t('common.loading') : t('common.confirm')}
                  </button>
                  <button
                    className="flex-1 text-xs border border-gray-300 rounded-lg py-2 hover:bg-gray-50"
                    onClick={() =>
                      setStatusModal((prev) => prev && { ...prev, pendingNew: null })
                    }
                  >
                    {t('common.back')}
                  </button>
                </div>
                {statusChangeMutation.isError && (
                  <p className="text-xs text-red-600 mt-2 text-center">
                    {t('common.error')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { NEGOTIATION_TRANSITIONS, COMMITTEE_EXTRA_TRANSITIONS, ATHLETE_TRANSITIONS, NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'
import { STATUS_COLORS, formatPerf } from '@web/lib/ui-constants'
import { computeScore } from '@shared/scoring'
import type {
  NegotiationStatus,
  Agreement,
  Interaction,
  Hotel,
  HotelRoom,
  Event,
  EventCatalog,
  Athlete,
  Application,
  WaPerformance,
  AthleteDetail,
  ApplicationForAthlete,
  EditionCosts,
} from '@shared/types'

interface HotelWithRooms extends Hotel {
  rooms: HotelRoom[]
}

interface StaffUser {
  id: string
  firstName: string
  lastName: string
  role: string
}

interface ApplicationRow extends Application {
  athlete: Athlete
  event: Event & { catalog: EventCatalog }
  waPerformance: WaPerformance | null
}

// ── Agreement form defaults ──────────────────────────────────────────────────

function defaultAgreement(existing?: Agreement) {
  if (existing) {
    return {
      appearanceFee: existing.appearanceFee,
      otherCompensation: existing.otherCompensation,
      otherCompensationDesc: existing.otherCompensationDesc ?? '',
      transport: existing.transport,
      transportAirportHotel: existing.transportAirportHotel,
      transportHotelStadium: existing.transportHotelStadium,
      hotelRoomId: existing.hotelRoomId ?? '',
      hotelNightTue: existing.hotelNightTue,
      hotelNightWed: existing.hotelNightWed,
      hotelNightThu: existing.hotelNightThu,
      hotelNightFri: existing.hotelNightFri,
      hotelNightSat: existing.hotelNightSat,
      hotelNightSun: existing.hotelNightSun,
      dinnerTue: existing.dinnerTue,
      dinnerWed: existing.dinnerWed,
      dinnerThu: existing.dinnerThu,
      dinnerFri: existing.dinnerFri,
      dinnerSat: existing.dinnerSat,
      dinnerSun: existing.dinnerSun,
      stadiumMeals: existing.stadiumMeals,
      notes: existing.notes ?? '',
    }
  }
  return {
    appearanceFee: 0,
    otherCompensation: 0,
    otherCompensationDesc: '',
    transport: 0,
    transportAirportHotel: true,
    transportHotelStadium: true,
    hotelRoomId: '',
    hotelNightTue: false,
    hotelNightWed: false,
    hotelNightThu: true,
    hotelNightFri: true,
    hotelNightSat: true,
    hotelNightSun: false,
    dinnerTue: false,
    dinnerWed: false,
    dinnerThu: true,
    dinnerFri: true,
    dinnerSat: true,
    dinnerSun: false,
    stadiumMeals: true,
    notes: '',
  }
}

// ── Sub-components ───────────────────────────────────────────────────────────

function CollapsibleSection({ title, isOpen, onToggle, canEdit, isEditing, onToggleEdit, children }: {
  title: string; isOpen: boolean; onToggle: () => void
  canEdit?: boolean; isEditing?: boolean; onToggleEdit?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-gray-50">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {canEdit && isOpen && (
            <span
              onClick={e => { e.stopPropagation(); onToggleEdit?.() }}
              className={`text-xs cursor-pointer px-1.5 py-0.5 rounded ${isEditing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
              title={isEditing ? 'Cancel edit' : 'Edit'}
            >
              ✎
            </span>
          )}
          <span className="text-gray-400 text-xs">{isOpen ? '▾' : '▸'}</span>
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'
  options?: { value: string; label: string }[]
}

function FieldReadOnly({ athlete, fields, t }: {
  athlete: Athlete; fields: FieldDef[]; t: (key: string) => string
}) {
  return (
    <div className="space-y-1.5">
      {fields.map(f => {
        const raw = (athlete as unknown as Record<string, unknown>)[f.key]
        let display: string
        if (f.type === 'checkbox') {
          display = raw ? t('common.yes') : t('common.no')
        } else if (f.type === 'select') {
          display = f.options?.find(o => o.value === raw)?.label ?? String(raw ?? '—')
        } else {
          display = raw != null && raw !== '' && raw !== 0 ? String(raw) : '—'
        }
        return (
          <div key={f.key} className="flex justify-between text-xs">
            <span className="text-gray-500">{f.label}</span>
            <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{display}</span>
          </div>
        )
      })}
    </div>
  )
}

function AthleteFieldEditor({ athlete, fields, onSave, isPending, error, t }: {
  athlete: Athlete
  fields: FieldDef[]
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  error: Error | null
  t: (key: string) => string
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of fields) {
      init[f.key] = (athlete as unknown as Record<string, unknown>)[f.key] ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')
    }
    return init
  })

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="space-y-2">
      {fields.map(f => (
        <div key={f.key}>
          {f.type === 'checkbox' ? (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form[f.key] as boolean}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} />
              {f.label}
            </label>
          ) : f.type === 'select' ? (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <select className={inputCls} value={form[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </>
          ) : f.type === 'textarea' ? (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <textarea className={inputCls} rows={2} value={form[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <input type={f.type} className={inputCls} value={form[f.key] as string | number}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value }))} />
            </>
          )}
        </div>
      ))}
      <button
        onClick={() => onSave(form)}
        disabled={isPending}
        className="mt-2 text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
      {error && <p className="text-xs text-red-600">{error.message || t('common.error')}</p>}
    </div>
  )
}

function SelectorAssign({ currentValue, staffUsers, onSave, isPending, t }: {
  currentValue: string | null
  staffUsers: StaffUser[]
  onSave: (val: string) => void
  isPending: boolean
  t: (key: string) => string
}) {
  const [value, setValue] = useState(currentValue ?? '')
  return (
    <div className="space-y-2">
      <select
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        value={value}
        onChange={e => setValue(e.target.value)}
      >
        <option value="">— {t('common.unassigned')} —</option>
        {staffUsers.map(u => (
          <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
        ))}
      </select>
      <button
        onClick={() => onSave(value)}
        disabled={isPending}
        className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
    </div>
  )
}

function AgreementCard({ agreement: c, t, isStaff }: { agreement: Agreement; t: (key: string) => string; isStaff: boolean }) {
  const nights = [
    c.hotelNightTue, c.hotelNightWed, c.hotelNightThu,
    c.hotelNightFri, c.hotelNightSat, c.hotelNightSun,
  ].filter(Boolean).length

  const dinners = [
    c.dinnerTue, c.dinnerWed, c.dinnerThu,
    c.dinnerFri, c.dinnerSat, c.dinnerSun,
  ].filter(Boolean).length

  // Only show non-empty fields (Phase 5.2 requirement)
  const rows: Array<{ label: string; value: string }> = []
  if (c.appearanceFee > 0) rows.push({ label: t('contract.bonus'), value: `CHF ${c.appearanceFee}` })
  if (c.otherCompensation > 0) rows.push({ label: t('contract.otherCompensation'), value: `CHF ${c.otherCompensation}` })
  if (c.transport > 0) rows.push({ label: t('contract.transport'), value: `CHF ${c.transport}` })
  if (nights > 0) rows.push({ label: t('contract.hotelNights'), value: String(nights) })
  if (dinners > 0) rows.push({ label: t('contract.dinners'), value: String(dinners) })

  return (
    <div className={`p-3 rounded border text-xs ${
      c.direction === 'to_athlete' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'
    }`}>
      <div className="flex justify-between mb-1">
        <span className="font-semibold">
          v{c.version} — {c.direction === 'to_athlete' ? t('contract.toAthlete') : t('contract.counterOffer')}
        </span>
        <span className="text-gray-500">{new Date(c.sentAt).toLocaleDateString()}</span>
      </div>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-1 text-gray-600">
          {rows.map(r => <span key={r.label}>{r.label}: {r.value}</span>)}
        </div>
      )}
      {isStaff && c.totalCost > 0 && (
        <div className="mt-1 font-semibold text-gray-900">
          {t('contract.totalCost')}: CHF {c.totalCost.toLocaleString()}
        </div>
      )}
      {c.notes && <p className="mt-1 text-gray-500 italic">{c.notes}</p>}
    </div>
  )
}

function InteractionCard({ interaction, onViewEmail }: { interaction: Interaction; onViewEmail?: (emailLogId: string) => void }) {
  const typeIcons: Record<string, string> = {
    status_change: '●',
    agreement: '■',
    counter_offer: '◆',
    note: '✎',
    call: '☎',
    email: '✉',
  }

  const typeColors: Record<string, string> = {
    status_change: 'text-blue-500',
    agreement: 'text-green-500',
    counter_offer: 'text-purple-500',
    note: 'text-gray-500',
    call: 'text-orange-500',
    email: 'text-indigo-500',
  }

  const hasEmail = !!interaction.emailLogId
  const clickable = hasEmail && onViewEmail

  return (
    <div
      className={`flex gap-2 ${clickable ? 'cursor-pointer hover:bg-gray-50 rounded p-1 -m-1' : ''}`}
      onClick={clickable ? () => onViewEmail(interaction.emailLogId!) : undefined}
    >
      <span className={`${typeColors[interaction.type] ?? 'text-gray-400'} mt-0.5 shrink-0`}>
        {typeIcons[interaction.type] ?? '●'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-900">
          {interaction.content}
          {hasEmail && <span className="ml-1 text-indigo-500" title="View email">✉</span>}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {interaction.authorName} — {new Date(interaction.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

// ── Scoring popup (hover over score) ─────────────────────────────────────────

function ScoringPopup({ app, athlete, edition, t }: {
  app: ApplicationForAthlete
  athlete: AthleteDetail
  edition: EditionCosts
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const wp = app.waPerformance
  if (!wp || wp.personalBest == null || !edition) return null

  const perfType = app.event.catalog.discipline === 'Course' ? 'MIN' as const : 'MAX' as const

  const breakdown = computeScore({
    personalBest: wp.personalBest ?? 0,
    seasonBest: wp.seasonBest ?? 0,
    worldRanking: wp.worldRanking ?? 100,
    estimatedCostTotal: athlete.estTotal ?? 0,
    isEap: athlete.isEap,
    isSwiss: athlete.isSwiss,
    perfType,
    intMinima: app.event.intMinima,
    swissMinima: app.event.swissMinima,
    eapMinima: app.event.eapMinima,
  }, edition)

  return (
    <div className="absolute z-20 left-0 top-6 bg-white border rounded-lg shadow-lg p-3 text-xs w-52">
      <p className="font-semibold mb-2">{t('selection.scoringBreakdown')}</p>
      <div className="space-y-1 text-gray-600">
        <div className="flex justify-between">
          <span>PB ({edition.weightPB}%)</span>
          <span className="font-mono">{(breakdown.f1PB * 100).toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>SB ({edition.weightSB}%)</span>
          <span className="font-mono">{(breakdown.f2SB * 100).toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Ranking ({edition.weightRanking}%)</span>
          <span className="font-mono">{(breakdown.f3Ranking * 100).toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Cost ({edition.weightCost}%)</span>
          <span className="font-mono">{(breakdown.f4Cost * 100).toFixed(1)}</span>
        </div>
        {breakdown.eapBonus > 0 && (
          <div className="flex justify-between">
            <span>EAP bonus (+{edition.bonusEap}%)</span>
            <span className="font-mono">+{(breakdown.eapBonus * 100).toFixed(1)}</span>
          </div>
        )}
        <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span className="font-mono">{(breakdown.finalScore * 100).toFixed(0)}</span>
        </div>
        <div className="text-[10px] text-gray-400">
          {breakdown.eligible ? t('selection.eligible') : t('selection.notEligible')}
        </div>
      </div>
    </div>
  )
}

// ── Confirmed athletes popup (hover over event name) ──────────────────────────

function ConfirmedAthletesPopup({ eventId, t }: {
  eventId: string
  t: (key: string) => string
}) {
  const { data: confirmed = [], isLoading } = useQuery<ApplicationRow[]>({
    queryKey: ['confirmed-athletes', eventId],
    queryFn: () => api.get(`/api/v1/applications?eventId=${eventId}&negotiationStatus=confirmed`),
    staleTime: 60_000,
  })

  return (
    <div className="absolute z-20 left-0 top-6 bg-white border rounded-lg shadow-lg p-3 text-xs w-56">
      <p className="font-semibold mb-2">{t('selection.confirmedAthletes')}</p>
      {isLoading ? (
        <p className="text-gray-400">{t('common.loading')}</p>
      ) : confirmed.length === 0 ? (
        <p className="text-gray-400">{t('selection.noConfirmedAthletes')}</p>
      ) : (
        <div className="space-y-1">
          {[...confirmed]
            .sort((a, b) => {
              const sb1 = a.waPerformance?.seasonBest ?? a.seasonBest ?? null
              const sb2 = b.waPerformance?.seasonBest ?? b.seasonBest ?? null
              if (sb1 == null && sb2 == null) return 0
              if (sb1 == null) return 1
              if (sb2 == null) return -1
              return sb2 - sb1
            })
            .map(a => (
              <div key={a.id} className="flex justify-between text-gray-700">
                <span>{a.athlete.lastName}, {a.athlete.firstName}</span>
                <span className="font-mono text-gray-500">
                  {formatPerf(a.waPerformance?.seasonBest ?? a.seasonBest ?? null)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ── SB color helper ──────────────────────────────────────────────────────────

function sbColorClass(sb: number | null, app: ApplicationForAthlete, athlete: AthleteDetail): string {
  if (sb == null) return ''
  const perfType = app.event.catalog.discipline === 'Course' ? 'MIN' : 'MAX'
  const minima = [app.event.intMinima]
  if (athlete.isSwiss) minima.push(app.event.swissMinima)
  if (athlete.isEap && app.event.eapMinima != null) minima.push(app.event.eapMinima)

  const meetsSome = minima.some(m => perfType === 'MIN' ? sb <= m : sb >= m)
  return meetsSome ? 'text-green-600' : 'text-red-600'
}

// ── Banner event row ─────────────────────────────────────────────────────────

function BannerEventRow({ app, athlete, edition, isStaff, onParticipationChange, onRescore, onWaPerfSave, isPendingParticipation, t }: {
  app: ApplicationForAthlete
  athlete: AthleteDetail
  edition: EditionCosts | null
  isStaff: boolean
  onParticipationChange: (appId: string, status: string) => void
  onRescore: (appId: string) => void
  onWaPerfSave: (athleteId: string, eventId: string, data: { personalBest?: number; seasonBest?: number; worldRanking?: number }) => void
  isPendingParticipation: boolean
  t: (key: string) => string
}) {
  const [showEventPopup, setShowEventPopup] = useState(false)
  const [showScorePopup, setShowScorePopup] = useState(false)
  const [editingPerf, setEditingPerf] = useState(false)
  const [perfForm, setPerfForm] = useState({
    personalBest: app.waPerformance?.personalBest != null ? String(app.waPerformance.personalBest) : '',
    seasonBest: app.waPerformance?.seasonBest != null ? String(app.waPerformance.seasonBest) : '',
    worldRanking: app.waPerformance?.worldRanking != null ? String(app.waPerformance.worldRanking) : '',
  })

  const wp = app.waPerformance
  const pb = wp?.personalBest ?? app.personalBest
  const sb = wp?.seasonBest ?? app.seasonBest
  const wr = wp?.worldRanking ?? app.worldRanking

  const PARTICIPATION_COLORS: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    selected: 'bg-green-100 text-green-800',
    not_selected: 'bg-red-100 text-red-800',
  }

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="flex items-center gap-3 py-1.5 border-b border-gray-100 last:border-0">
      {/* Event name with hover popup */}
      <div className="relative shrink-0 w-28">
        <button
          onMouseEnter={() => setShowEventPopup(true)}
          onMouseLeave={() => setShowEventPopup(false)}
          className="font-medium text-sm text-gray-900 hover:text-blue-700 text-left truncate block w-full"
        >
          {app.event.catalog.name}
        </button>
        {showEventPopup && <ConfirmedAthletesPopup eventId={app.eventId} t={t} />}
      </div>

      {/* PB / SB (colored) / Ranking */}
      {editingPerf ? (
        <div className="flex gap-1 items-center flex-1">
          <input type="number" step="0.01" placeholder="PB" className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs" value={perfForm.personalBest}
            onChange={e => setPerfForm(p => ({ ...p, personalBest: e.target.value }))} />
          <input type="number" step="0.01" placeholder="SB" className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs" value={perfForm.seasonBest}
            onChange={e => setPerfForm(p => ({ ...p, seasonBest: e.target.value }))} />
          <input type="number" placeholder="#" className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs" value={perfForm.worldRanking}
            onChange={e => setPerfForm(p => ({ ...p, worldRanking: e.target.value }))} />
          <button onClick={() => {
            onWaPerfSave(athlete.id, app.eventId, {
              ...(perfForm.personalBest ? { personalBest: parseFloat(perfForm.personalBest) } : {}),
              ...(perfForm.seasonBest ? { seasonBest: parseFloat(perfForm.seasonBest) } : {}),
              ...(perfForm.worldRanking ? { worldRanking: parseInt(perfForm.worldRanking) } : {}),
            })
            setEditingPerf(false)
          }} className="text-[10px] text-green-600 hover:text-green-800">✓</button>
          <button onClick={() => setEditingPerf(false)} className="text-[10px] text-gray-400 hover:text-gray-600">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs text-gray-600 flex-1">
          <span>PB: <span className="font-mono font-medium">{formatPerf(pb)}</span></span>
          <span>SB: <span className={`font-mono font-medium ${sbColorClass(sb, app, athlete)}`}>{formatPerf(sb)}</span></span>
          <span>#{wr ?? '—'}</span>

          {/* Score with popup */}
          {app.score != null && (
            <div className="relative">
              <button
                onMouseEnter={() => setShowScorePopup(true)}
                onMouseLeave={() => setShowScorePopup(false)}
                className="font-mono font-bold text-sm text-gray-900 hover:text-blue-700"
              >
                {(app.score * 100).toFixed(0)}
              </button>
              {showScorePopup && edition && (
                <ScoringPopup app={app} athlete={athlete} edition={edition} t={t} />
              )}
            </div>
          )}

          {/* Recommendation */}
          {app.recommendation && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              app.recommendation === 'Highly Recommended' ? 'bg-green-100 text-green-700' :
              app.recommendation === 'Recommended' ? 'bg-blue-100 text-blue-700' :
              app.recommendation === 'Under Review' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {app.recommendation}
            </span>
          )}
        </div>
      )}

      {/* Participation status — staff gets buttons, athlete/manager gets read-only badge */}
      <div className="flex gap-1 shrink-0">
        {isStaff ? (
          <>
            {(['pending', 'selected', 'not_selected'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  if (app.participationStatus !== status) {
                    onParticipationChange(app.id, status)
                  }
                }}
                disabled={isPendingParticipation || app.participationStatus === status}
                className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                  app.participationStatus === status
                    ? PARTICIPATION_COLORS[status] ?? 'bg-gray-100 text-gray-500'
                    : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                }`}
              >
                {t(`participation.${status}`)}
              </button>
            ))}
          </>
        ) : (
          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${PARTICIPATION_COLORS[app.participationStatus] ?? 'bg-gray-100 text-gray-500'}`}>
            {t(`participation.${app.participationStatus}`)}
          </span>
        )}
      </div>

      {/* Staff-only: edit perf + rescore */}
      {isStaff && !editingPerf && (
        <div className="flex gap-1 shrink-0">
          <button onClick={() => setEditingPerf(true)} className="text-[10px] text-blue-600 hover:text-blue-800">
            {t('selection.editPerformance')}
          </button>
          <button onClick={() => onRescore(app.id)} className="text-[10px] text-gray-400 hover:text-gray-600">
            {t('selection.rescore')}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Cost hover popup ─────────────────────────────────────────────────────────

function CostPopup({ athlete, latestAgreement, costMode, t }: {
  athlete: AthleteDetail
  latestAgreement: Agreement | undefined
  costMode: string
  t: (key: string) => string
}) {
  return (
    <div className="absolute z-20 right-0 top-6 bg-white border rounded-lg shadow-lg p-3 text-xs w-56">
      {costMode === 'confirmed' && !latestAgreement ? (
        <p className="text-green-700 italic">{t('selection.acceptedAtMeeting')}</p>
      ) : costMode !== 'estimated' && latestAgreement ? (
        <div className="space-y-1 text-gray-600">
          {latestAgreement.appearanceFee > 0 && <div className="flex justify-between"><span>{t('contract.bonus')}</span><span>CHF {latestAgreement.appearanceFee}</span></div>}
          {latestAgreement.transport > 0 && <div className="flex justify-between"><span>{t('contract.transport')}</span><span>CHF {latestAgreement.transport}</span></div>}
          {latestAgreement.otherCompensation > 0 && <div className="flex justify-between"><span>{t('contract.otherCompensation')}</span><span>CHF {latestAgreement.otherCompensation}</span></div>}
          <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-gray-900">
            <span>{t('contract.totalCost')}</span>
            <span>CHF {(latestAgreement.totalCost ?? 0).toLocaleString()}</span>
          </div>
          <div className="text-[10px] text-gray-400">v{latestAgreement.version} — {new Date(latestAgreement.sentAt).toLocaleDateString()}</div>
        </div>
      ) : (
        <div className="space-y-1 text-gray-600">
          <div className="flex justify-between"><span>{t('collaborator.estTravel')}</span><span>CHF {athlete.estTravel}</span></div>
          <div className="flex justify-between"><span>{t('collaborator.estAccommodation')}</span><span>CHF {athlete.estAccommodation}</span></div>
          <div className="flex justify-between"><span>{t('collaborator.estAppearance')}</span><span>CHF {athlete.estAppearance}</span></div>
          <div className="border-t pt-1 mt-1 flex justify-between font-semibold text-gray-900">
            <span>{t('contract.totalCost')}</span>
            <span>CHF {(athlete.estTotal ?? 0).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AthletePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<'personal' | 'negotiation'>('personal')
  const [openSection, setOpenSection] = useState<string | null>('identity')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<NegotiationStatus | null>(null)
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email'>('note')
  const [noteContent, setNoteContent] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [agreementForm, setAgreementForm] = useState(() => defaultAgreement())
  const [showCostPopup, setShowCostPopup] = useState(false)
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false)
  const [counterOfferText, setCounterOfferText] = useState('')
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null)

  const { data: athlete, isLoading } = useQuery<AthleteDetail>({
    queryKey: ['athlete', id],
    queryFn: () => api.get(`/api/v1/athletes/${id}`),
    enabled: !!id,
  })

  const { data: hotels = [] } = useQuery<HotelWithRooms[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/api/v1/hotels'),
  })

  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ['staff-users'],
    queryFn: () => api.get('/api/v1/users?role=collaborator,committee'),
  })

  // Email popup query — only fetches when an email is being viewed
  const { data: viewingEmail } = useQuery<{ subject: string; body: string; htmlBody?: string; to: string; sentAt: string }>({
    queryKey: ['email', viewingEmailId],
    queryFn: () => api.get(`/api/v1/emails/${viewingEmailId}`),
    enabled: !!viewingEmailId,
  })

  const allRooms = hotels.flatMap(h => h.rooms.map(r => ({ ...r, hotelName: h.name })))

  const latestAgreement = athlete?.agreements?.length
    ? athlete.agreements[athlete.agreements.length - 1]
    : undefined

  if (athlete && !notesInitialized) {
    setInternalNotes(athlete.internalNotes ?? '')
    if (latestAgreement) {
      setAgreementForm(defaultAgreement(latestAgreement))
    }
    setNotesInitialized(true)
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: (status: NegotiationStatus) =>
      api.patch(`/api/v1/athletes/${id}/negotiation-status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const agreementMutation = useMutation({
    mutationFn: (data: ReturnType<typeof defaultAgreement>) =>
      api.post(`/api/v1/athletes/${id}/agreements`, {
        ...data,
        hotelRoomId: data.hotelRoomId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete', id] })
      setShowAgreementForm(false)
    },
  })

  const noteMutation = useMutation({
    mutationFn: (data: { type: string; content: string }) =>
      api.post(`/api/v1/athletes/${id}/interactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete', id] })
      setNoteContent('')
    },
  })

  const internalNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      api.patch(`/api/v1/athletes/${id}`, { internalNotes: notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const participationMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      api.patch(`/api/v1/applications/${appId}/participation-status`, { participationStatus: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const scoreMutation = useMutation({
    mutationFn: (appId: string) => api.post(`/api/v1/applications/${appId}/score`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const athleteUpdateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/api/v1/athletes/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const waPerfMutation = useMutation({
    mutationFn: (data: { athleteId: string; eventId: string; personalBest?: number; seasonBest?: number; worldRanking?: number }) =>
      api.post('/api/v1/wa-performance', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['athlete', id] }),
  })

  const counterOfferMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.post(`/api/v1/athletes/${id}/interactions`, { type: 'counter_offer', content: text })
      await api.patch(`/api/v1/athletes/${id}/negotiation-status`, { status: 'counter_offer_sent' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete', id] })
      setShowCounterOfferModal(false)
      setCounterOfferText('')
    },
  })

  const freeMessageMutation = useMutation({
    mutationFn: (text: string) =>
      api.post(`/api/v1/athletes/${id}/interactions`, { type: 'note', content: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete', id] })
      setShowMessageModal(false)
      setMessageText('')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/athletes/${id}`),
    onSuccess: () => navigate(
      user?.role === 'committee' ? '/committee/candidates' :
      user?.role === 'manager' ? '/manager/portal' :
      user?.role === 'athlete' ? '/athlete/portal' :
      '/collaborator/candidates'
    ),
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading || !athlete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const isStaff = user?.role === 'collaborator' || user?.role === 'committee'
  const isCommittee = user?.role === 'committee'
  const isAthleteOrManager = user?.role === 'athlete' || user?.role === 'manager'

  const currentStatus = athlete.negotiationStatus as NegotiationStatus
  let allowedTransitions: NegotiationStatus[]
  if (isAthleteOrManager) {
    allowedTransitions = ATHLETE_TRANSITIONS[currentStatus] ?? []
  } else {
    const baseTransitions = NEGOTIATION_TRANSITIONS[currentStatus] ?? []
    const extraTransitions = isCommittee ? (COMMITTEE_EXTRA_TRANSITIONS[currentStatus] ?? []) : []
    allowedTransitions = [...baseTransitions, ...extraTransitions]
  }

  const allDecided = athlete.applications.length > 0
    && athlete.applications.every(a => a.participationStatus !== 'pending')

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  const toggleSection = (name: string) => setOpenSection(openSection === name ? null : name)

  const costMode =
    currentStatus === 'confirmed' ? 'confirmed' :
    ['agreement_sent', 'counter_offer_sent'].includes(currentStatus) ? 'negotiating' :
    'estimated'

  const isCommitteeOnly = (status: NegotiationStatus) => {
    if (isAthleteOrManager) return false
    const base = NEGOTIATION_TRANSITIONS[currentStatus] ?? []
    const extra = isCommittee ? (COMMITTEE_EXTRA_TRANSITIONS[currentStatus] ?? []) : []
    return !base.includes(status) && extra.includes(status)
  }

  // Cost summary text for banner (estTotal and totalCost are undefined for athlete/manager roles)
  const costSummary = (() => {
    if (costMode === 'confirmed' && athlete.agreements.length === 0) return t('selection.acceptedAtMeeting')
    if (costMode !== 'estimated' && latestAgreement) return latestAgreement.totalCost != null ? `CHF ${latestAgreement.totalCost.toLocaleString()}` : ''
    return athlete.estTotal != null ? `CHF ${athlete.estTotal.toLocaleString()}` : ''
  })()

  const costLabel = costMode === 'confirmed' ? t('selection.confirmedCostLabel') :
    costMode === 'negotiating' ? t('selection.costInNegotiation') :
    t('selection.estimatedCostLabel')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Banner ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row: navigation + language */}
          <div className="flex items-center justify-between mb-3">
            <Link
              to={
                isCommittee ? '/committee/candidates' :
                user?.role === 'manager' ? '/manager/portal' :
                user?.role === 'athlete' ? '/athlete/portal' :
                '/collaborator/candidates'
              }
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              ← {t('common.back')}
            </Link>
            <LanguageSwitcher />
          </div>

          {/* Athlete info + actions */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-bold">
                  {athlete.lastName}, {athlete.firstName}
                </h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[currentStatus]}`}>
                  {t(`status.${currentStatus}`)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
                <span className={
                  athlete.isSwiss ? 'text-red-600 font-semibold' :
                  athlete.isEap ? 'text-blue-600 font-semibold' : ''
                }>
                  {athlete.nationality}
                  {athlete.isSwiss && ' (SUI)'}
                </span>
                {athlete.isEap && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">EAP</span>
                )}
                {athlete.dateOfBirth && <span>{athlete.dateOfBirth}</span>}
                {athlete.federation && <span>— {athlete.federation}</span>}
                {athlete.club && <span>· {athlete.club}</span>}
                {athlete.gender && (
                  <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">
                    {athlete.gender}
                  </span>
                )}
                {athlete.managerName && (
                  <span className="text-xs text-gray-500">
                    Manager: {athlete.managerName}
                  </span>
                )}
                {athlete.waProfileUrl && (
                  <a href={athlete.waProfileUrl} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800" title="World Athletics">
                    WA ↗
                  </a>
                )}
                {/* Cost summary — staff only */}
                {isStaff && (
                  <div className="relative ml-auto">
                    <button
                      onMouseEnter={() => setShowCostPopup(true)}
                      onMouseLeave={() => setShowCostPopup(false)}
                      className={`text-xs font-medium px-2 py-0.5 rounded border cursor-default ${
                        costMode === 'confirmed' ? 'border-green-200 bg-green-50 text-green-700' :
                        costMode === 'negotiating' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                        'border-gray-200 bg-gray-50 text-gray-600'
                      }`}
                    >
                      {costLabel}: {costSummary}
                    </button>
                    {showCostPopup && (
                      <CostPopup athlete={athlete} latestAgreement={latestAgreement} costMode={costMode} t={t} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 justify-end shrink-0">
              {allowedTransitions.map((status) => {
                const needsConfirm = ['confirmed', 'rejected', 'withdrawn', 'to_review'].includes(status)
                const committeeOnly = isCommitteeOnly(status as NegotiationStatus)

                // Athlete/manager-specific labels
                const buttonLabel = isAthleteOrManager
                  ? status === 'confirmed' ? t('action.acceptOffer')
                    : status === 'counter_offer_sent' ? t('action.counterOffer')
                    : status === 'withdrawn' ? t('action.withdraw')
                    : t(`status.${status}`)
                  : committeeOnly && status === 'to_review'
                    ? t('status.rattraper')
                    : t(`status.${status}`)

                return (
                  <button
                    key={status}
                    onClick={() => {
                      if (isAthleteOrManager && status === 'counter_offer_sent') {
                        setShowCounterOfferModal(true)
                      } else if (status === 'agreement_sent' && isStaff) {
                        setActiveTab('negotiation')
                        setShowAgreementForm(true)
                      } else if (needsConfirm) {
                        setConfirmAction(status as NegotiationStatus)
                      } else {
                        statusMutation.mutate(status as NegotiationStatus)
                      }
                    }}
                    disabled={statusMutation.isPending}
                    title={committeeOnly ? t('selection.rattraper') : undefined}
                    className={`text-xs px-3 py-1.5 rounded font-medium border ${
                      status === 'confirmed'
                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        : status === 'rejected'
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : status === 'withdrawn'
                        ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        : status === 'agreement_sent'
                        ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                        : status === 'counter_offer_sent'
                        ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                        : status === 'to_review' && committeeOnly
                        ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {buttonLabel}
                  </button>
                )
              })}

              {/* Send message — always visible for all roles, all statuses */}
              <button
                onClick={() => setShowMessageModal(true)}
                className="text-xs px-3 py-1.5 rounded font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              >
                {t('action.sendMessage')}
              </button>

              {allowedTransitions.length === 0 && !isAthleteOrManager && (
                <span className="text-xs text-gray-400 py-1.5">{t('selection.noActions')}</span>
              )}
            </div>
          </div>

          {/* Confirm dialog */}
          {confirmAction && (
            <div className="mt-3 p-3 rounded border border-yellow-300 bg-yellow-50">
              <p className="text-sm text-gray-900 mb-3">
                {t('confirm.statusChange', {
                  athlete: `${athlete.firstName} ${athlete.lastName}`,
                  status: confirmAction === 'to_review' ? t('status.rattraper') : t(`status.${confirmAction}`),
                })}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    statusMutation.mutate(confirmAction)
                    setConfirmAction(null)
                  }}
                  className={`text-xs px-3 py-1.5 rounded font-medium ${
                    confirmAction === 'confirmed'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : confirmAction === 'rejected'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : confirmAction === 'to_review'
                      ? 'bg-orange-600 text-white hover:bg-orange-700'
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                >
                  {t('common.confirm')}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}

          {statusMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{(statusMutation.error as Error)?.message || t('common.error')}</p>
          )}

          {/* Counter-offer modal — free text for athlete/manager */}
          {showCounterOfferModal && (
            <div className="mt-3 p-4 rounded border border-purple-300 bg-purple-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('action.counterOffer')}</h3>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                rows={4}
                placeholder={t('action.counterOfferPlaceholder')}
                value={counterOfferText}
                onChange={e => setCounterOfferText(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    if (counterOfferText.trim()) {
                      counterOfferMutation.mutate(counterOfferText)
                    }
                  }}
                  disabled={counterOfferMutation.isPending || !counterOfferText.trim()}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {counterOfferMutation.isPending ? t('common.loading') : t('common.submit')}
                </button>
                <button
                  onClick={() => { setShowCounterOfferModal(false); setCounterOfferText('') }}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
              {counterOfferMutation.isError && (
                <p className="text-xs text-red-600 mt-1">{(counterOfferMutation.error as Error)?.message || t('common.error')}</p>
              )}
            </div>
          )}

          {/* Send message modal — always available */}
          {showMessageModal && (
            <div className="mt-3 p-4 rounded border border-gray-300 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('action.sendMessage')}</h3>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                rows={3}
                placeholder={t('action.messagePlaceholder')}
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    if (messageText.trim()) {
                      freeMessageMutation.mutate(messageText)
                    }
                  }}
                  disabled={freeMessageMutation.isPending || !messageText.trim()}
                  className="text-xs px-3 py-1.5 rounded font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {freeMessageMutation.isPending ? t('common.loading') : t('common.submit')}
                </button>
                <button
                  onClick={() => { setShowMessageModal(false); setMessageText('') }}
                  className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
                >
                  {t('common.cancel')}
                </button>
              </div>
              {freeMessageMutation.isError && (
                <p className="text-xs text-red-600 mt-1">{(freeMessageMutation.error as Error)?.message || t('common.error')}</p>
              )}
            </div>
          )}

          {/* Events in banner — per spec */}
          {athlete.applications.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="text-xs font-semibold text-gray-500 mb-1">{t('selection.participation')}</div>
              {athlete.applications.map(app => (
                <BannerEventRow
                  key={app.id}
                  app={app}
                  athlete={athlete}
                  edition={athlete.edition}
                  isStaff={!!isStaff}
                  onParticipationChange={(appId, status) =>
                    participationMutation.mutate({ appId, status })
                  }
                  onRescore={(appId) => scoreMutation.mutate(appId)}
                  onWaPerfSave={(athleteId, eventId, data) =>
                    waPerfMutation.mutate({ athleteId, eventId, ...data })
                  }
                  isPendingParticipation={participationMutation.isPending}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tab navigation */}
        <div className="max-w-7xl mx-auto px-6 flex gap-0 border-t">
          {(['personal', 'negotiation'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'personal' ? t('collaborator.tabPersonal') : t('collaborator.tabNegotiation')}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ──────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">

        {/* ── Tab 1: Personal Data ──────────────────────────────────────── */}
        {activeTab === 'personal' && (() => {
          // Field definitions for each section
          const identityFields: FieldDef[] = [
            { key: 'firstName', label: t('athlete.firstName'), type: 'text' },
            { key: 'lastName', label: t('athlete.lastName'), type: 'text' },
            { key: 'dateOfBirth', label: t('athlete.dateOfBirth'), type: 'date' },
            { key: 'nationality', label: t('athlete.nationality'), type: 'text' },
            { key: 'gender', label: t('athlete.gender'), type: 'select', options: [
              { value: 'M', label: t('athlete.male') }, { value: 'F', label: t('athlete.female') }
            ]},
            { key: 'federation', label: t('athlete.federation'), type: 'text' },
            { key: 'club', label: t('athlete.club'), type: 'text' },
            { key: 'athleteEmail', label: t('athlete.email'), type: 'text' },
            { key: 'athletePhone', label: t('athlete.phone'), type: 'text' },
            { key: 'waProfileUrl', label: t('athlete.waProfile'), type: 'text' },
            { key: 'swiLicence', label: t('athlete.swissLicence'), type: 'text' },
            { key: 'honours', label: t('athlete.honours'), type: 'text' },
            { key: 'distanceFromGva', label: t('athlete.distanceFromGva'), type: 'number' },
            { key: 'isEap', label: t('athlete.eapMember'), type: 'checkbox' },
            { key: 'isSwiss', label: t('athlete.swiss'), type: 'checkbox' },
            { key: 'eapCity', label: t('athlete.eapCity'), type: 'text' },
          ]
          // Athletes/managers can only edit contact fields from identity
          const athleteIdentityFields: FieldDef[] = identityFields.filter(f =>
            ['athleteEmail', 'athletePhone'].includes(f.key)
          )

          const complianceFields: FieldDef[] = [
            { key: 'iRunClean', label: t('compliance.iRunClean'), type: 'select', options: [
              { value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') },
              { value: 'in_progress', label: t('common.inProgress') }, { value: 'unknown', label: t('common.unknown') },
            ]},
            { key: 'dopingFree', label: t('compliance.dopingFree'), type: 'select', options: [
              { value: 'yes', label: t('common.yes') }, { value: 'no', label: t('common.no') }, { value: 'unknown', label: t('common.unknown') },
            ]},
          ]

          const logisticsFields: FieldDef[] = [
            { key: 'arrivalDate', label: `${t('logistics.arrival')} ${t('logistics.date')}`, type: 'date' },
            { key: 'arrivalFlight', label: `${t('logistics.arrival')} ${t('logistics.flightNumber')}`, type: 'text' },
            { key: 'arrivalFrom', label: `${t('logistics.arrival')} ${t('logistics.from')}`, type: 'text' },
            { key: 'arrivalTime', label: `${t('logistics.arrival')} ${t('logistics.time')}`, type: 'text' },
            { key: 'departureDate', label: `${t('logistics.departure')} ${t('logistics.date')}`, type: 'date' },
            { key: 'departureFlight', label: `${t('logistics.departure')} ${t('logistics.flightNumber')}`, type: 'text' },
            { key: 'departureTo', label: `${t('logistics.departure')} ${t('logistics.to')}`, type: 'text' },
            { key: 'departureTime', label: `${t('logistics.departure')} ${t('logistics.time')}`, type: 'text' },
            { key: 'accommodationReqs', label: t('logistics.specialRequests'), type: 'textarea' },
          ]

          const costFields: FieldDef[] = [
            { key: 'estTravel', label: t('collaborator.estTravel'), type: 'number' },
            { key: 'estAccommodation', label: t('collaborator.estAccommodation'), type: 'number' },
            { key: 'estAppearance', label: t('collaborator.estAppearance'), type: 'number' },
          ]

          const paymentFields: FieldDef[] = [
            { key: 'bankIban', label: t('collaborator.iban'), type: 'text' },
            { key: 'paymentStatus', label: t('collaborator.paymentStatus'), type: 'select', options: [
              { value: 'pending', label: t('common.pending') }, { value: 'done', label: t('common.done') },
            ]},
            { key: 'paymentAmount', label: t('collaborator.paymentAmount'), type: 'number' },
            { key: 'paymentDate', label: t('collaborator.paymentDate'), type: 'date' },
            { key: 'paymentMethod', label: t('collaborator.paymentMethod'), type: 'select', options: [
              { value: '', label: '—' }, { value: 'cash', label: t('collaborator.cash') },
              { value: 'bank', label: t('collaborator.bank') }, { value: 'western_union', label: t('collaborator.westernUnion') },
              { value: 'paypal', label: t('collaborator.paypal') }, { value: 'other', label: t('collaborator.other') },
            ]},
          ]

          const toggleEdit = (section: string) => setEditingSection(editingSection === section ? null : section)

          // Helper to render a section with view/edit toggle
          const renderSection = (name: string, title: string, fields: FieldDef[], canEdit: boolean) => (
            <CollapsibleSection
              title={title}
              isOpen={openSection === name}
              onToggle={() => toggleSection(name)}
              canEdit={canEdit}
              isEditing={editingSection === name}
              onToggleEdit={() => toggleEdit(name)}
            >
              {editingSection === name && canEdit ? (
                <AthleteFieldEditor
                  athlete={athlete}
                  fields={fields}
                  onSave={(data) => { athleteUpdateMutation.mutate(data); setEditingSection(null) }}
                  isPending={athleteUpdateMutation.isPending}
                  error={athleteUpdateMutation.error}
                  t={t}
                />
              ) : (
                <FieldReadOnly athlete={athlete} fields={fields} t={t} />
              )}
            </CollapsibleSection>
          )

          return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              {/* Identity — staff can edit all, athlete/manager can edit contact only */}
              {isStaff
                ? renderSection('identity', t('collaborator.identity'), identityFields, true)
                : (
                  <>
                    <CollapsibleSection title={t('collaborator.identity')} isOpen={openSection === 'identity'} onToggle={() => toggleSection('identity')}>
                      <FieldReadOnly athlete={athlete} fields={identityFields.filter(f => !['athleteEmail', 'athletePhone'].includes(f.key))} t={t} />
                    </CollapsibleSection>
                    {renderSection('contact', t('athlete.contact'), athleteIdentityFields, true)}
                  </>
                )
              }

              {/* Compliance — editable by all */}
              {renderSection('compliance', t('compliance.title'), complianceFields, true)}

              {/* Logistics — editable by all */}
              {renderSection('logistics', t('logistics.title'), logisticsFields, true)}
            </div>

            <div className="space-y-4">
              {/* Assigned selector — staff only */}
              {isStaff && (
                <CollapsibleSection title={t('selection.assignedSelector')} isOpen={openSection === 'selector'} onToggle={() => toggleSection('selector')}>
                  <SelectorAssign
                    currentValue={athlete.assignedSelector}
                    staffUsers={staffUsers}
                    onSave={(val) => athleteUpdateMutation.mutate({ assignedSelector: val || null })}
                    isPending={athleteUpdateMutation.isPending}
                    t={t}
                  />
                </CollapsibleSection>
              )}

              {/* Cost estimates — staff only */}
              {isStaff && (
                <>
                  {renderSection('costs', t('selection.estimatedCost'), costFields, true)}
                </>
              )}

              {/* Payment — staff only */}
              {isStaff && renderSection('payment', t('collaborator.payment'), paymentFields, true)}

              {/* Notes */}
              <CollapsibleSection title={t('common.notes')} isOpen={openSection === 'notes'} onToggle={() => toggleSection('notes')}>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('collaborator.participantNotes')}</label>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded min-h-[2rem]">{athlete.participantNotes || '—'}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t('collaborator.additionalNotes')}</label>
                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded min-h-[2rem]">{athlete.additionalNotes || '—'}</p>
                  </div>
                  {isStaff && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">{t('collaborator.internalNotes')}</label>
                      <textarea
                        className={inputCls}
                        rows={3}
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                      />
                      <button
                        onClick={() => internalNotesMutation.mutate(internalNotes)}
                        disabled={internalNotesMutation.isPending}
                        className="mt-2 text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                      >
                        {t('common.save')}
                      </button>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            </div>
          </div>
          )
        })()}

        {/* ── Tab 2: Agreement & Negotiation ───────────────────────────── */}
        {activeTab === 'negotiation' && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Agreements */}
            <div className="space-y-4">
              {/* Agreement history */}
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{t('contract.title')}</h3>
                  {isStaff && !showAgreementForm && !['confirmed', 'rejected', 'withdrawn'].includes(currentStatus) && (
                    <button
                      onClick={() => setShowAgreementForm(true)}
                      disabled={!allDecided}
                      className={`text-xs ${allDecided ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      {latestAgreement ? t('contract.newVersion') : t('contract.sendOffer')}
                    </button>
                  )}
                </div>

                {currentStatus === 'confirmed' && athlete.agreements.length === 0 ? (
                  <p className="text-sm text-green-700 italic">{t('selection.acceptedAtMeeting')}</p>
                ) : athlete.agreements.length === 0 && !showAgreementForm ? (
                  <p className="text-xs text-gray-400">{t('contract.noOfferYet')}</p>
                ) : (
                  <div className="space-y-3">
                    {athlete.agreements.map(c => (
                      <AgreementCard key={c.id} agreement={c} t={t} isStaff={!!isStaff} />
                    ))}
                  </div>
                )}
              </div>

              {/* Agreement form — staff only */}
              {showAgreementForm && isStaff && (
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-sm mb-3">
                    {t('contract.sendOffer')} — v{(athlete.agreements.length || 0) + 1}
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
                      <input type="number" className={inputCls} value={agreementForm.appearanceFee}
                        onChange={e => setAgreementForm(p => ({ ...p, appearanceFee: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>{t('contract.otherCompensation')} (CHF)</label>
                        <input type="number" className={inputCls} value={agreementForm.otherCompensation}
                          onChange={e => setAgreementForm(p => ({ ...p, otherCompensation: parseInt(e.target.value) || 0 }))} />
                      </div>
                      <div>
                        <label className={labelCls}>{t('contract.description')}</label>
                        <input className={inputCls} value={agreementForm.otherCompensationDesc}
                          onChange={e => setAgreementForm(p => ({ ...p, otherCompensationDesc: e.target.value }))}
                          placeholder={t('contract.otherCompensationDesc')} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('contract.transport')} (CHF)</label>
                      <input type="number" className={inputCls} value={agreementForm.transport}
                        onChange={e => setAgreementForm(p => ({ ...p, transport: parseInt(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={agreementForm.transportAirportHotel}
                          onChange={e => setAgreementForm(p => ({ ...p, transportAirportHotel: e.target.checked }))} />
                        {t('contract.transportAirportHotel')}
                      </label>
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={agreementForm.transportHotelStadium}
                          onChange={e => setAgreementForm(p => ({ ...p, transportHotelStadium: e.target.checked }))} />
                        {t('contract.transportHotelStadium')}
                      </label>
                    </div>
                    <div>
                      <label className={labelCls}>{t('logistics.hotel')}</label>
                      <select className={inputCls} value={agreementForm.hotelRoomId}
                        onChange={e => setAgreementForm(p => ({ ...p, hotelRoomId: e.target.value }))}>
                        <option value="">— {t('contract.noHotelRoom')} —</option>
                        {allRooms.map(r => (
                          <option key={r.id} value={r.id}>{r.hotelName} — {r.roomType} (CHF {r.costPerNight}/night)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{t('contract.hotelNights')}</label>
                      <div className="flex gap-2">
                        {NIGHT_LABELS.map(night => {
                          const key = `hotelNight${night.charAt(0).toUpperCase() + night.slice(1)}` as keyof typeof agreementForm
                          return (
                            <label key={night} className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                              agreementForm[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                            }`}>
                              <input type="checkbox" className="sr-only" checked={agreementForm[key] as boolean}
                                onChange={e => setAgreementForm(p => ({ ...p, [key]: e.target.checked }))} />
                              {t(`night.${night}`)}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{t('contract.dinners')}</label>
                      <div className="flex gap-2">
                        {DINNER_LABELS.map(day => {
                          const key = `dinner${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof typeof agreementForm
                          return (
                            <label key={day} className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                              agreementForm[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                            }`}>
                              <input type="checkbox" className="sr-only" checked={agreementForm[key] as boolean}
                                onChange={e => setAgreementForm(p => ({ ...p, [key]: e.target.checked }))} />
                              {t(`night.${day}`)}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={agreementForm.stadiumMeals}
                        onChange={e => setAgreementForm(p => ({ ...p, stadiumMeals: e.target.checked }))} />
                      {t('contract.stadiumMeals')}
                    </label>
                    <div>
                      <label className={labelCls}>{t('contract.notesToAthlete')}</label>
                      <textarea className={inputCls} rows={2} value={agreementForm.notes}
                        onChange={e => setAgreementForm(p => ({ ...p, notes: e.target.value }))} />
                    </div>

                    {/* Live cost preview */}
                    {(() => {
                      const room = allRooms.find(r => r.id === agreementForm.hotelRoomId)
                      const nights = NIGHT_LABELS.filter(n => agreementForm[`hotelNight${n.charAt(0).toUpperCase() + n.slice(1)}` as keyof typeof agreementForm]).length
                      const dinners = DINNER_LABELS.filter(d => agreementForm[`dinner${d.charAt(0).toUpperCase() + d.slice(1)}` as keyof typeof agreementForm]).length
                      let total = agreementForm.appearanceFee + agreementForm.otherCompensation + agreementForm.transport
                      total += nights * (room?.costPerNight ?? 0)
                      total += dinners * (room?.dinnerCost ?? 0)
                      if (agreementForm.stadiumMeals) total += athlete.edition?.stadiumMealCost ?? 0
                      if (agreementForm.transportAirportHotel) total += athlete.edition?.transportAirportHotelCost ?? 0
                      if (agreementForm.transportHotelStadium) total += athlete.edition?.transportHotelStadiumCost ?? 0
                      return (
                        <div className="bg-gray-50 rounded p-3 text-sm">
                          <div className="flex justify-between font-semibold">
                            <span>{t('contract.totalCost')}</span>
                            <span>CHF {total.toLocaleString()}</span>
                          </div>
                        </div>
                      )
                    })()}

                    <div className="flex gap-2">
                      <button
                        onClick={() => agreementMutation.mutate(agreementForm)}
                        disabled={agreementMutation.isPending}
                        className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {agreementMutation.isPending ? t('common.loading') : t('contract.sendOffer')}
                      </button>
                      <button
                        onClick={() => setShowAgreementForm(false)}
                        className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                    {agreementMutation.isError && (
                      <p className="text-xs text-red-600">{(agreementMutation.error as Error)?.message || t('common.error')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Timeline */}
            <div className="space-y-4">
              {/* Add interaction */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">{t('collaborator.addNote')}</h3>
                {isStaff && (
                  <select
                    className={`${inputCls} mb-2`}
                    value={noteType}
                    onChange={e => setNoteType(e.target.value as typeof noteType)}
                  >
                    <option value="note">{t('collaborator.note')}</option>
                    <option value="call">{t('collaborator.phoneCall')}</option>
                    <option value="email">{t('athlete.email')}</option>
                  </select>
                )}
                <textarea
                  className={inputCls}
                  rows={3}
                  placeholder={t('collaborator.enterNote')}
                  value={noteContent}
                  onChange={e => setNoteContent(e.target.value)}
                />
                <button
                  onClick={() => {
                    if (noteContent.trim()) {
                      noteMutation.mutate({ type: isAthleteOrManager ? 'note' : noteType, content: noteContent })
                    }
                  }}
                  disabled={noteMutation.isPending || !noteContent.trim()}
                  className="mt-2 text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
                >
                  {t('common.add')}
                </button>
              </div>

              {/* Timeline — limited height with scrollbar */}
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">{t('collaborator.timeline')}</h3>
                {athlete.interactions.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('collaborator.noInteractions')}</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {athlete.interactions.map(interaction => (
                      <InteractionCard key={interaction.id} interaction={interaction} onViewEmail={setViewingEmailId} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Archive button — committee only */}
        {isCommittee && !athlete.archivedAt && (
          <div className="mt-6 text-right">
            <button
              onClick={() => {
                if (confirm(t('confirm.archiveAthlete', { athlete: `${athlete.firstName} ${athlete.lastName}` }))) {
                  archiveMutation.mutate()
                }
              }}
              disabled={archiveMutation.isPending}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
            >
              {t('collaborator.archiveAthlete')}
            </button>
            {archiveMutation.isError && (
              <p className="text-xs text-red-600 mt-1">{(archiveMutation.error as Error)?.message || t('common.error')}</p>
            )}
          </div>
        )}
      </div>

      {/* Email popup modal */}
      {viewingEmailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setViewingEmailId(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-sm">{t('collaborator.emailDetail')}</h3>
              <button onClick={() => setViewingEmailId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {viewingEmail ? (
              <div className="p-4 text-sm space-y-2">
                <div className="text-xs text-gray-500">
                  <span className="font-medium">{t('admin.emailTo')}:</span> {viewingEmail.to}
                </div>
                <div className="text-xs text-gray-500">
                  <span className="font-medium">{t('admin.subject')}:</span> {viewingEmail.subject}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(viewingEmail.sentAt).toLocaleString()}
                </div>
                <div className="border-t pt-3 mt-2">
                  {viewingEmail.htmlBody ? (
                    <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewingEmail.htmlBody }} />
                  ) : (
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">{viewingEmail.body}</pre>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-gray-400">{t('common.loading')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

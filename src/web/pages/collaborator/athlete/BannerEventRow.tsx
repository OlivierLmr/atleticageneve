import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { computeScore } from '@shared/scoring'
import { formatPerf, parseHumanPerf } from '@web/lib/ui-constants'
import { NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'
import type { AthleteDetail, ApplicationForAthlete, EditionCosts, Agreement } from '@shared/types'

// ── ScoringPopup ────────────────────────────────────────────────────────────

export function ScoringPopup({ app, athlete, edition, t, style }: {
  app: ApplicationForAthlete
  athlete: AthleteDetail
  edition: EditionCosts
  t: (key: string, opts?: Record<string, unknown>) => string
  style?: React.CSSProperties
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

  const posStyle: React.CSSProperties = style ?? { position: 'absolute', zIndex: 20, left: 0, top: '1.5rem' }

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs w-52" style={posStyle}>
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

// ── ConfirmedAthletesPopup ──────────────────────────────────────────────────

type ConfirmedAthleteEntry = {
  id: string
  firstName: string
  lastName: string
  seasonBest: number | null
}

function ConfirmedAthletesPopup({ eventId, discipline, t }: {
  eventId: string
  discipline: string
  t: (key: string) => string
}) {
  const { data: confirmed = [], isLoading } = useQuery<ConfirmedAthleteEntry[]>({
    queryKey: ['confirmed-athletes', eventId],
    queryFn: () => api.get(`/api/v1/portal/events/${eventId}/confirmed-athletes`),
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
              const sb1 = a.seasonBest
              const sb2 = b.seasonBest
              if (sb1 == null && sb2 == null) return 0
              if (sb1 == null) return 1
              if (sb2 == null) return -1
              // Field events: higher is better (desc); track events: lower is better (asc)
              return discipline === 'Concours' ? sb2 - sb1 : sb1 - sb2
            })
            .map(a => (
              <div key={a.id} className="flex justify-between text-gray-700">
                <span>{a.lastName}, {a.firstName}</span>
                <span className="font-mono text-gray-500">
                  {formatPerf(a.seasonBest, discipline)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ── SB color helper ─────────────────────────────────────────────────────────

function sbColorClass(sb: number | null, app: ApplicationForAthlete, athlete: AthleteDetail): string {
  if (sb == null) return ''
  const perfType = app.event.catalog.discipline === 'Course' ? 'MIN' : 'MAX'
  const minima = [app.event.intMinima]
  if (athlete.isSwiss) minima.push(app.event.swissMinima)
  if (athlete.isEap && app.event.eapMinima != null) minima.push(app.event.eapMinima)

  const meetsSome = minima.some(m => perfType === 'MIN' ? sb <= m : sb >= m)
  return meetsSome ? 'text-green-600' : 'text-red-600'
}

// ── BannerEventRow ──────────────────────────────────────────────────────────

export function BannerEventRow({ app, athlete, edition, isStaff, onParticipationChange, onRescore, onWaPerfSave, isPendingParticipation, t }: {
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
    personalBest: app.waPerformance?.personalBest != null
      ? formatPerf(app.waPerformance.personalBest, app.event.catalog.discipline)
      : '',
    seasonBest: app.waPerformance?.seasonBest != null
      ? formatPerf(app.waPerformance.seasonBest, app.event.catalog.discipline)
      : '',
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
        {showEventPopup && <ConfirmedAthletesPopup eventId={app.eventId} discipline={app.event.catalog.discipline} t={t} />}
      </div>

      {/* PB / SB (colored) / Ranking */}
      {editingPerf ? (
        <div className="flex gap-1 items-center flex-1">
          <input type="text" placeholder="PB" className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs font-mono" value={perfForm.personalBest}
            onChange={e => setPerfForm(p => ({ ...p, personalBest: e.target.value }))} />
          <input type="text" placeholder="SB" className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs font-mono" value={perfForm.seasonBest}
            onChange={e => setPerfForm(p => ({ ...p, seasonBest: e.target.value }))} />
          <input type="number" placeholder="#" className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs" value={perfForm.worldRanking}
            onChange={e => setPerfForm(p => ({ ...p, worldRanking: e.target.value }))} />
          <button onClick={() => {
            const disc = app.event.catalog.discipline
            const parsedPB = parseHumanPerf(perfForm.personalBest, disc)
            const parsedSB = parseHumanPerf(perfForm.seasonBest, disc)
            onWaPerfSave(athlete.id, app.eventId, {
              ...(parsedPB != null ? { personalBest: parsedPB } : {}),
              ...(parsedSB != null ? { seasonBest: parsedSB } : {}),
              ...(perfForm.worldRanking ? { worldRanking: parseInt(perfForm.worldRanking) } : {}),
            })
            setEditingPerf(false)
          }} className="text-[10px] text-green-600 hover:text-green-800">✓</button>
          <button onClick={() => setEditingPerf(false)} className="text-[10px] text-gray-400 hover:text-gray-600">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-xs text-gray-600 flex-1">
          <span>PB: <span className="font-mono font-medium">{formatPerf(pb, app.event.catalog.discipline)}</span></span>
          <span>SB: <span className={`font-mono font-medium ${sbColorClass(sb, app, athlete)}`}>{formatPerf(sb, app.event.catalog.discipline)}</span></span>
          <span>#{wr ?? '—'}</span>

          {/* Score with popup — staff only */}
          {isStaff && app.score != null && (
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

          {/* Recommendation — staff only */}
          {isStaff && app.recommendation && (
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

      {/* Participation status */}
      <div className="flex gap-1 shrink-0 items-center">
        {isStaff && athlete.negotiationStatus !== 'confirmed' ? (
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
          <>
            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${PARTICIPATION_COLORS[app.participationStatus] ?? 'bg-gray-100 text-gray-500'}`}>
              {t(`participation.${app.participationStatus}`)}
            </span>
            {isStaff && athlete.negotiationStatus === 'confirmed' && (
              <span className="text-[10px] text-gray-400" title={t('participation.lockedConfirmed')}>🔒</span>
            )}
          </>
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

// ── CostPopup ───────────────────────────────────────────────────────────────

export function CostPopup({ athlete, latestAgreement, costMode, allRooms, t, style }: {
  athlete: AthleteDetail
  latestAgreement: Agreement | undefined
  costMode: string
  allRooms: { id: string; costPerNight: number; dinnerCost: number }[]
  t: (key: string) => string
  style?: React.CSSProperties
}) {
  const room = latestAgreement ? allRooms.find(r => r.id === latestAgreement.hotelRoomId) : undefined
  const nightCount = latestAgreement
    ? NIGHT_LABELS.filter(n => latestAgreement[`hotelNight${n.charAt(0).toUpperCase() + n.slice(1)}` as keyof Agreement]).length
    : 0
  const dinnerCount = latestAgreement
    ? DINNER_LABELS.filter(d => latestAgreement[`dinner${d.charAt(0).toUpperCase() + d.slice(1)}` as keyof Agreement]).length
    : 0
  const hotelCost = nightCount * (room?.costPerNight ?? 0)
  const dinnerCost = dinnerCount * (room?.dinnerCost ?? 0)
  const stadiumMealCost = latestAgreement?.stadiumMeals ? (athlete.edition?.stadiumMealCost ?? 0) : 0
  const transportAHCost = latestAgreement?.transportAirportHotel ? (athlete.edition?.transportAirportHotelCost ?? 0) : 0
  const transportHSCost = latestAgreement?.transportHotelStadium ? (athlete.edition?.transportHotelStadiumCost ?? 0) : 0

  const posStyle: React.CSSProperties = style ?? { position: 'absolute', zIndex: 20, right: 0, top: '1.5rem' }

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 text-xs w-64" style={posStyle}>
      {costMode === 'confirmed' && !latestAgreement ? (
        <p className="text-green-700 italic">{t('selection.acceptedAtMeeting')}</p>
      ) : costMode !== 'estimated' && latestAgreement ? (
        <div className="space-y-1 text-gray-600">
          {latestAgreement.appearanceFee > 0 && <div className="flex justify-between"><span>{t('contract.bonus')}</span><span>CHF {latestAgreement.appearanceFee.toLocaleString()}</span></div>}
          {latestAgreement.transport > 0 && <div className="flex justify-between"><span>{t('contract.transport')}</span><span>CHF {latestAgreement.transport.toLocaleString()}</span></div>}
          {latestAgreement.otherCompensation > 0 && <div className="flex justify-between"><span>{t('contract.otherCompensation')}</span><span>CHF {latestAgreement.otherCompensation.toLocaleString()}</span></div>}
          {hotelCost > 0 && <div className="flex justify-between"><span>{t('contract.hotelNights')} ({nightCount})</span><span>CHF {hotelCost.toLocaleString()}</span></div>}
          {dinnerCost > 0 && <div className="flex justify-between"><span>{t('contract.dinners')} ({dinnerCount})</span><span>CHF {dinnerCost.toLocaleString()}</span></div>}
          {stadiumMealCost > 0 && <div className="flex justify-between"><span>{t('contract.stadiumMeals')}</span><span>CHF {stadiumMealCost.toLocaleString()}</span></div>}
          {transportAHCost > 0 && <div className="flex justify-between"><span>{t('contract.transportAirportHotel')}</span><span>CHF {transportAHCost.toLocaleString()}</span></div>}
          {transportHSCost > 0 && <div className="flex justify-between"><span>{t('contract.transportHotelStadium')}</span><span>CHF {transportHSCost.toLocaleString()}</span></div>}
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

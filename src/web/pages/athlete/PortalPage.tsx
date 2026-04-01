import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'
import { STATUS_COLORS, PARTICIPATION_COLORS, formatPerf } from '@web/lib/ui-constants'
import type { Application, Athlete, Event, Agreement, Interaction, ParticipationStatus, WaPerformance, Hotel, HotelRoom } from '@shared/types'

interface PortalEvent extends Event {
  name: string
  discipline: string
  gender: string
}

interface PortalApplication extends Application {
  event: PortalEvent | null
  waPerformance: WaPerformance | null
}

interface PortalAthlete extends Athlete {
  applications: PortalApplication[]
  agreements: Agreement[]
  interactions: Interaction[]
}

export default function AthletePortalPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeAthleteId, setActiveAthleteId] = useState<string | null>(null)
  const [showCounter, setShowCounter] = useState(false)

  const { data, isLoading } = useQuery<{ athletes: PortalAthlete[] }>({
    queryKey: ['athlete-portal'],
    queryFn: () => api.get('/api/v1/portal/athlete'),
  })

  const { data: hotels = [] } = useQuery<(Hotel & { rooms: HotelRoom[] })[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/api/v1/hotels'),
  })

  const allHotelRooms: HotelRoomOption[] = hotels.flatMap(h =>
    h.rooms.map(r => ({ id: r.id, hotelName: h.name, roomType: r.roomType, costPerNight: r.costPerNight }))
  )

  const athletes = data?.athletes ?? []
  const selected = athletes.find((a) => a.id === activeAthleteId) ?? athletes[0]

  const respondMutation = useMutation({
    mutationFn: (params: { athleteId: string; action: string; offer?: unknown }) =>
      api.post(`/api/v1/portal/athlete/${params.athleteId}/respond`, {
        action: params.action,
        offer: params.offer,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['athlete-portal'] })
      setShowCounter(false)
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const latestOffer = selected?.agreements?.filter((c) => c.direction === 'to_athlete').slice(-1)[0]
  const canRespond = selected?.negotiationStatus === 'agreement_sent'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold">Atletica Genève</Link>
            <span className="text-xs text-gray-400">{t('athlete.portal')}</span>
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

      <div className="max-w-5xl mx-auto px-6 py-6">
        {athletes.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-400 text-sm mb-4">{t('athlete.noApplications')}</p>
            <Link to="/athlete/register" className="text-sm text-blue-600 underline">
              {t('athlete.registerForEvent')}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: athlete list */}
            <div className="space-y-2">
              {athletes.map((ath) => (
                <button
                  key={ath.id}
                  onClick={() => { setActiveAthleteId(ath.id); setShowCounter(false) }}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    selected?.id === ath.id
                      ? 'border-gray-900 bg-white'
                      : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium">{ath.firstName} {ath.lastName}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[ath.negotiationStatus]}`}>
                      {t(`status.${ath.negotiationStatus}`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {ath.applications.map(a => a.event?.name).filter(Boolean).join(', ') || t('athlete.noEvents')}
                  </p>
                </button>
              ))}
            </div>

            {/* Center + Right: detail */}
            {selected && (
              <div className="col-span-2 space-y-4">
                {/* Athlete overview */}
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="font-semibold">{selected.firstName} {selected.lastName}</h2>
                      <p className="text-xs text-gray-400">{selected.nationality} · {selected.gender === 'M' ? t('athlete.male') : t('athlete.female')}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.negotiationStatus]}`}>
                      {t(`status.${selected.negotiationStatus}`)}
                    </span>
                  </div>
                </div>

                {/* Applications table — per-event detail */}
                <div className="bg-white rounded-lg border p-4">
                  <h3 className="font-semibold text-sm mb-3">{t('athlete.event')}(s)</h3>
                  {selected.applications.length === 0 ? (
                    <p className="text-xs text-gray-400">—</p>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b text-gray-500">
                          <th className="py-1.5 text-left font-medium">{t('athlete.event')}</th>
                          <th className="py-1.5 text-right font-medium">{t('athlete.personalBest')}</th>
                          <th className="py-1.5 text-right font-medium">{t('athlete.seasonBest')}</th>
                          <th className="py-1.5 text-right font-medium">{t('athlete.worldRanking')}</th>
                          <th className="py-1.5 text-center font-medium">{t('selection.participation')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.applications.map((app) => (
                          <tr key={app.id} className="border-b last:border-0">
                            <td className="py-2 font-medium">{app.event?.name ?? '—'}</td>
                            <td className="py-2 text-right">{formatPerf(app.waPerformance?.personalBest)}</td>
                            <td className="py-2 text-right">{formatPerf(app.waPerformance?.seasonBest)}</td>
                            <td className="py-2 text-right">{app.waPerformance?.worldRanking ?? '—'}</td>
                            <td className="py-2 text-center">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PARTICIPATION_COLORS[app.participationStatus as ParticipationStatus]}`}>
                                {t(`participation.${app.participationStatus}`)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Latest offer — hide totalCost for athletes */}
                {latestOffer ? (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">{t('contract.offerReceived')} (v{latestOffer.version})</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.bonus')}</span>
                        <span>CHF {latestOffer.appearanceFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.transport')}</span>
                        <span>CHF {latestOffer.transport.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.otherCompensation')}</span>
                        <span>CHF {latestOffer.otherCompensation.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.hotelNights')}</span>
                        <span>
                          {[
                            latestOffer.hotelNightTue, latestOffer.hotelNightWed, latestOffer.hotelNightThu,
                            latestOffer.hotelNightFri, latestOffer.hotelNightSat, latestOffer.hotelNightSun,
                          ].filter(Boolean).length} nights
                        </span>
                      </div>
                    </div>
                    {latestOffer.otherCompensationDesc && (
                      <p className="text-xs text-gray-500 mb-2">{latestOffer.otherCompensationDesc}</p>
                    )}
                    {latestOffer.notes && (
                      <p className="text-xs text-gray-500 italic mt-2">{latestOffer.notes}</p>
                    )}

                    {/* Actions */}
                    {canRespond && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => respondMutation.mutate({ athleteId: selected.id, action: 'accept' })}
                          disabled={respondMutation.isPending}
                          className="flex-1 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          {t('contract.acceptOffer')}
                        </button>
                        <button
                          onClick={() => setShowCounter(true)}
                          disabled={respondMutation.isPending}
                          className="flex-1 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                        >
                          {t('contract.counterOffer')}
                        </button>
                        <button
                          onClick={() => respondMutation.mutate({ athleteId: selected.id, action: 'reject' })}
                          disabled={respondMutation.isPending}
                          className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {t('contract.declineOffer')}
                        </button>
                      </div>
                    )}

                    {respondMutation.isError && (
                      <p className="text-xs text-red-600 mt-2">{(respondMutation.error as Error)?.message || t('common.error')}</p>
                    )}
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border p-4 text-center text-gray-400 text-sm">
                    {t('contract.noOfferYet')}
                  </div>
                )}

                {/* Counter-offer form */}
                {showCounter && latestOffer && (
                  <CounterOfferForm
                    latestOffer={latestOffer}
                    t={t}
                    onSubmit={(offer) => respondMutation.mutate({ athleteId: selected.id, action: 'counter_offer', offer })}
                    onCancel={() => setShowCounter(false)}
                    isPending={respondMutation.isPending}
                    hotelRooms={allHotelRooms}
                  />
                )}

                {/* Agreement history */}
                {selected.agreements.length > 1 && (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">{t('contract.offerHistory')}</h3>
                    <div className="space-y-2">
                      {selected.agreements.map((c) => (
                        <div key={c.id} className={`p-2 rounded text-xs border ${
                          c.direction === 'to_athlete' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'
                        }`}>
                          <div className="flex justify-between">
                            <span className="font-medium">
                              v{c.version} — {c.direction === 'to_athlete' ? t('contract.fromOrganizer') : t('contract.yourCounterOffer')}
                            </span>
                            <span className="text-gray-500">{new Date(c.sentAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interaction history */}
                {selected.interactions && selected.interactions.length > 0 && (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">{t('collaborator.activity')}</h3>
                    <div className="space-y-2">
                      {selected.interactions.slice(0, 10).map((ix) => (
                        <div key={ix.id} className="flex items-start gap-2 text-xs border-b pb-2 last:border-0">
                          <span className="text-gray-400 whitespace-nowrap">
                            {new Date(ix.createdAt).toLocaleDateString()}
                          </span>
                          <span className="text-gray-600">{ix.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Withdraw button */}
                {['to_review', 'agreement_sent', 'counter_offer_sent', 'confirmed'].includes(selected.negotiationStatus) && (
                  <div className="text-right">
                    <button
                      onClick={() => {
                        if (confirm(t('confirm.withdraw'))) {
                          respondMutation.mutate({ athleteId: selected.id, action: 'withdraw' })
                        }
                      }}
                      className="text-xs text-gray-400 hover:text-red-600"
                    >
                      {t('contract.withdraw')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Counter-offer form ───────────────────────────────────────────────────────

interface HotelRoomOption {
  id: string
  hotelName: string
  roomType: string
  costPerNight: number
}

function CounterOfferForm({
  latestOffer,
  t,
  onSubmit,
  onCancel,
  isPending,
  hotelRooms,
}: {
  latestOffer: Agreement
  t: (key: string) => string
  onSubmit: (offer: Record<string, unknown>) => void
  onCancel: () => void
  isPending: boolean
  hotelRooms: HotelRoomOption[]
}) {
  const [form, setForm] = useState({
    appearanceFee: latestOffer.appearanceFee,
    otherCompensation: latestOffer.otherCompensation,
    otherCompensationDesc: latestOffer.otherCompensationDesc ?? '',
    transport: latestOffer.transport,
    transportAirportHotel: latestOffer.transportAirportHotel,
    transportHotelStadium: latestOffer.transportHotelStadium,
    hotelNightTue: latestOffer.hotelNightTue,
    hotelNightWed: latestOffer.hotelNightWed,
    hotelNightThu: latestOffer.hotelNightThu,
    hotelNightFri: latestOffer.hotelNightFri,
    hotelNightSat: latestOffer.hotelNightSat,
    hotelNightSun: latestOffer.hotelNightSun,
    dinnerTue: latestOffer.dinnerTue,
    dinnerWed: latestOffer.dinnerWed,
    dinnerThu: latestOffer.dinnerThu,
    dinnerFri: latestOffer.dinnerFri,
    dinnerSat: latestOffer.dinnerSat,
    dinnerSun: latestOffer.dinnerSun,
    stadiumMeals: latestOffer.stadiumMeals,
    hotelRoomId: latestOffer.hotelRoomId ?? '',
    notes: '',
  })

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-sm mb-3">{t('contract.counterOffer')}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
            <input type="number" className={inputCls} value={form.appearanceFee}
              onChange={(e) => setForm((p) => ({ ...p, appearanceFee: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={labelCls}>{t('contract.transport')} (CHF)</label>
            <input type="number" className={inputCls} value={form.transport}
              onChange={(e) => setForm((p) => ({ ...p, transport: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('contract.otherCompensation')} (CHF)</label>
            <input type="number" className={inputCls} value={form.otherCompensation}
              onChange={(e) => setForm((p) => ({ ...p, otherCompensation: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={labelCls}>{t('contract.otherCompensationDesc')}</label>
            <input className={inputCls} value={form.otherCompensationDesc}
              onChange={(e) => setForm((p) => ({ ...p, otherCompensationDesc: e.target.value }))} />
          </div>
        </div>

        {hotelRooms.length > 0 && (
          <div>
            <label className={labelCls}>{t('logistics.hotel')}</label>
            <select className={inputCls} value={form.hotelRoomId}
              onChange={(e) => setForm((p) => ({ ...p, hotelRoomId: e.target.value }))}>
              <option value="">—</option>
              {hotelRooms.map(r => (
                <option key={r.id} value={r.id}>{r.hotelName} — {r.roomType} (CHF {r.costPerNight}/night)</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>{t('contract.hotelNights')}</label>
          <div className="flex gap-2">
            {NIGHT_LABELS.map((night) => {
              const key = `hotelNight${night.charAt(0).toUpperCase() + night.slice(1)}` as keyof typeof form
              return (
                <label key={night} className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                  form[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                }`}>
                  <input type="checkbox" className="sr-only" checked={form[key] as boolean}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))} />
                  {t(`night.${night}`)}
                </label>
              )
            })}
          </div>
        </div>

        <div>
          <label className={labelCls}>{t('contract.dinners')}</label>
          <div className="flex gap-2">
            {DINNER_LABELS.map((day) => {
              const key = `dinner${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof typeof form
              const lockedOff = !latestOffer[key as keyof Agreement]
              return (
                <label key={day} className={`flex flex-col items-center text-xs px-2 py-1 rounded border ${
                  lockedOff ? 'border-gray-200 bg-gray-100 text-gray-300 cursor-not-allowed' :
                  form[key] ? 'bg-gray-900 text-white border-gray-900 cursor-pointer' : 'border-gray-300 cursor-pointer'
                }`}>
                  <input type="checkbox" className="sr-only" checked={form[key] as boolean} disabled={lockedOff}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))} />
                  {t(`night.${day}`)}
                </label>
              )
            })}
          </div>
          {DINNER_LABELS.some(d => !latestOffer[`dinner${d.charAt(0).toUpperCase() + d.slice(1)}` as keyof Agreement]) && (
            <p className="text-[10px] text-gray-400 mt-1">{t('contract.dinnersLockedHint')}</p>
          )}
        </div>

        <div className="flex gap-4">
          {([
            ['stadiumMeals', t('contract.stadiumMeals')],
            ['transportAirportHotel', t('contract.transportAirportHotel')],
            ['transportHotelStadium', t('contract.transportHotelStadium')],
          ] as const).map(([key, label]) => {
            const lockedOff = !latestOffer[key]
            return (
              <label key={key} className={`flex items-center gap-2 text-xs ${lockedOff ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={form[key] as boolean} disabled={lockedOff}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.checked }))}
                  className="accent-gray-900" />
                {label}
              </label>
            )
          })}
        </div>

        <div>
          <label className={labelCls}>{t('contract.notesToOrganizer')}</label>
          <textarea className={inputCls} rows={2} value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>

        <div className="flex gap-2">
          <button onClick={() => onSubmit(form)} disabled={isPending}
            className="flex-1 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
            {isPending ? t('common.loading') : t('contract.counterOffer')}
          </button>
          <button onClick={onCancel} className="px-4 py-2 text-sm border rounded hover:bg-gray-50">
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}

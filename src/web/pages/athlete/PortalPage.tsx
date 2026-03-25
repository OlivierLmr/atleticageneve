import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { HOTEL_COST_PER_NIGHT, NIGHT_LABELS } from '@shared/constants'
import type { Application, Athlete, Event, ContractOffer, ApplicationStatus } from '@shared/types'

interface PortalApplication extends Application {
  athlete: Athlete
  event: Event
  contracts: ContractOffer[]
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  to_review: 'bg-yellow-100 text-yellow-800',
  contract_sent: 'bg-blue-100 text-blue-800',
  counter_offer: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

export default function AthletePortalPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()
  const [activeApp, setActiveApp] = useState<string | null>(null)
  const [showCounter, setShowCounter] = useState(false)

  const { data, isLoading } = useQuery<{ applications: PortalApplication[] }>({
    queryKey: ['athlete-portal'],
    queryFn: () => api.get('/api/v1/portal/athlete'),
  })

  const applications = data?.applications ?? []
  const selected = applications.find((a) => a.id === activeApp) ?? applications[0]

  const respondMutation = useMutation({
    mutationFn: (params: { appId: string; action: string; offer?: unknown }) =>
      api.post(`/api/v1/portal/athlete/${params.appId}/respond`, {
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

  const latestOffer = selected?.contracts?.filter((c) => c.direction === 'to_athlete').slice(-1)[0]
  const canRespond = selected?.status === 'contract_sent'

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
        {applications.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-400 text-sm mb-4">No applications found for your account.</p>
            <Link to="/athlete/register" className="text-sm text-blue-600 underline">
              Register for an event
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Left: application list */}
            <div className="space-y-2">
              {applications.map((app) => (
                <button
                  key={app.id}
                  onClick={() => { setActiveApp(app.id); setShowCounter(false) }}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    selected?.id === app.id
                      ? 'border-gray-900 bg-white'
                      : 'border-gray-200 bg-white hover:border-gray-400'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium">{app.event.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[app.status as ApplicationStatus]}`}>
                      {t(`status.${app.status}`)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    PB: {app.personalBest} · SB: {app.seasonBest}
                  </p>
                </button>
              ))}
            </div>

            {/* Center + Right: detail */}
            {selected && (
              <div className="col-span-2 space-y-4">
                {/* Application overview */}
                <div className="bg-white rounded-lg border p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h2 className="font-semibold">{selected.event.name}</h2>
                      <p className="text-xs text-gray-400">
                        {selected.athlete.firstName} {selected.athlete.lastName} · {selected.athlete.nationality}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[selected.status as ApplicationStatus]}`}>
                      {t(`status.${selected.status}`)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400">{t('athlete.personalBest')}</span>
                      <p className="font-mono font-medium">{selected.personalBest ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">{t('athlete.seasonBest')}</span>
                      <p className="font-mono font-medium">{selected.seasonBest ?? '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">{t('athlete.worldRanking')}</span>
                      <p className="font-mono font-medium">{selected.worldRanking ? `#${selected.worldRanking}` : '—'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">{t('selection.scoring')}</span>
                      <p className="font-mono font-medium">{selected.score != null ? (selected.score * 100).toFixed(0) : '—'}</p>
                    </div>
                  </div>
                </div>

                {/* Latest offer */}
                {latestOffer ? (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">{t('contract.offerReceived')} (v{latestOffer.version})</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.bonus')}</span>
                        <span>CHF {latestOffer.bonus.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.transport')}</span>
                        <span>CHF {latestOffer.transport.toLocaleString()}</span>
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
                      <div className="flex justify-between">
                        <span className="text-gray-500">{t('contract.catering')}</span>
                        <span>CHF {latestOffer.catering.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="font-semibold text-sm">{t('contract.totalCost')}</span>
                      <span className="text-lg font-bold">CHF {latestOffer.totalCost.toLocaleString()}</span>
                    </div>
                    {latestOffer.notes && (
                      <p className="text-xs text-gray-500 italic mt-2">{latestOffer.notes}</p>
                    )}

                    {/* Actions */}
                    {canRespond && (
                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => respondMutation.mutate({ appId: selected.id, action: 'accept' })}
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
                          onClick={() => respondMutation.mutate({ appId: selected.id, action: 'reject' })}
                          disabled={respondMutation.isPending}
                          className="px-4 py-2 text-sm border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {t('contract.declineOffer')}
                        </button>
                      </div>
                    )}

                    {respondMutation.isError && (
                      <p className="text-xs text-red-600 mt-2">{t('common.error')}</p>
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
                    onSubmit={(offer) => respondMutation.mutate({ appId: selected.id, action: 'counter_offer', offer })}
                    onCancel={() => setShowCounter(false)}
                    isPending={respondMutation.isPending}
                  />
                )}

                {/* Contract history */}
                {selected.contracts.length > 1 && (
                  <div className="bg-white rounded-lg border p-4">
                    <h3 className="font-semibold text-sm mb-3">Offer history</h3>
                    <div className="space-y-2">
                      {selected.contracts.map((c) => (
                        <div key={c.id} className={`p-2 rounded text-xs border ${
                          c.direction === 'to_athlete' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'
                        }`}>
                          <div className="flex justify-between">
                            <span className="font-medium">
                              v{c.version} — {c.direction === 'to_athlete' ? 'From organizer' : 'Your counter-offer'}
                            </span>
                            <span>CHF {c.totalCost.toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Withdraw button */}
                {['to_review', 'contract_sent', 'counter_offer', 'accepted'].includes(selected.status) && (
                  <div className="text-right">
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to withdraw this application?')) {
                          respondMutation.mutate({ appId: selected.id, action: 'withdraw' })
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

function CounterOfferForm({
  latestOffer,
  t,
  onSubmit,
  onCancel,
  isPending,
}: {
  latestOffer: ContractOffer
  t: (key: string) => string
  onSubmit: (offer: Record<string, unknown>) => void
  onCancel: () => void
  isPending: boolean
}) {
  const [form, setForm] = useState({
    bonus: latestOffer.bonus,
    otherCompensation: latestOffer.otherCompensation,
    transport: latestOffer.transport,
    localTransport: latestOffer.localTransport,
    hotelNightTue: latestOffer.hotelNightTue,
    hotelNightWed: latestOffer.hotelNightWed,
    hotelNightThu: latestOffer.hotelNightThu,
    hotelNightFri: latestOffer.hotelNightFri,
    hotelNightSat: latestOffer.hotelNightSat,
    hotelNightSun: latestOffer.hotelNightSun,
    catering: latestOffer.catering,
    notes: '',
  })

  const nights = [
    form.hotelNightTue, form.hotelNightWed, form.hotelNightThu,
    form.hotelNightFri, form.hotelNightSat, form.hotelNightSun,
  ].filter(Boolean).length

  const total = form.bonus + form.otherCompensation + form.transport + form.catering + nights * HOTEL_COST_PER_NIGHT

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold text-sm mb-3">{t('contract.counterOffer')}</h3>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
            <input type="number" className={inputCls} value={form.bonus}
              onChange={(e) => setForm((p) => ({ ...p, bonus: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <label className={labelCls}>{t('contract.transport')} (CHF)</label>
            <input type="number" className={inputCls} value={form.transport}
              onChange={(e) => setForm((p) => ({ ...p, transport: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>

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
          <label className={labelCls}>{t('contract.notesToOrganizer')}</label>
          <textarea className={inputCls} rows={2} value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
        </div>

        <div className="flex justify-between items-center py-2 border-t">
          <span className="text-sm font-semibold">{t('contract.totalCost')}</span>
          <span className="text-lg font-bold">CHF {total.toLocaleString()}</span>
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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { VALID_TRANSITIONS, HOTEL_COST_PER_NIGHT, NIGHT_LABELS } from '@shared/constants'
import type {
  ApplicationWithDetails,
  ApplicationStatus,
  ContractOffer,
  Interaction,
} from '@shared/types'

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  to_review: 'bg-yellow-100 text-yellow-800',
  contract_sent: 'bg-blue-100 text-blue-800',
  counter_offer: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
}

// ── Contract editor defaults ─────────────────────────────────────────────────

function defaultContract(existing?: ContractOffer) {
  if (existing) {
    return {
      bonus: existing.bonus,
      otherCompensation: existing.otherCompensation,
      transport: existing.transport,
      localTransport: existing.localTransport,
      hotelNightTue: existing.hotelNightTue,
      hotelNightWed: existing.hotelNightWed,
      hotelNightThu: existing.hotelNightThu,
      hotelNightFri: existing.hotelNightFri,
      hotelNightSat: existing.hotelNightSat,
      hotelNightSun: existing.hotelNightSun,
      catering: existing.catering,
      notes: existing.notes ?? '',
    }
  }
  return {
    bonus: 0,
    otherCompensation: 0,
    transport: 0,
    localTransport: false,
    hotelNightTue: false,
    hotelNightWed: false,
    hotelNightThu: true,
    hotelNightFri: true,
    hotelNightSat: true,
    hotelNightSun: false,
    catering: 0,
    notes: '',
  }
}

function computeContractTotal(c: ReturnType<typeof defaultContract>): number {
  const nights = [
    c.hotelNightTue, c.hotelNightWed, c.hotelNightThu,
    c.hotelNightFri, c.hotelNightSat, c.hotelNightSun,
  ].filter(Boolean).length
  return c.bonus + c.otherCompensation + c.transport + c.catering + nights * HOTEL_COST_PER_NIGHT
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AthletePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user, logout } = useAuth()
  const queryClient = useQueryClient()

  const { data: app, isLoading } = useQuery<ApplicationWithDetails>({
    queryKey: ['application', id],
    queryFn: () => api.get(`/api/v1/applications/${id}`),
    enabled: !!id,
  })

  // Contract form state
  const latestContract = app?.contracts?.length
    ? app.contracts[app.contracts.length - 1]
    : undefined
  const [contract, setContract] = useState(() => defaultContract(latestContract))
  const [showContractForm, setShowContractForm] = useState(false)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<ApplicationStatus | null>(null)

  // Note form
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email'>('note')
  const [noteContent, setNoteContent] = useState('')

  // Internal notes
  const [internalNotes, setInternalNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)

  // Initialize from fetched data
  if (app && !notesInitialized) {
    setInternalNotes(app.internalNotes ?? '')
    if (latestContract) {
      setContract(defaultContract(latestContract))
    }
    setNotesInitialized(true)
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: (status: ApplicationStatus) =>
      api.patch(`/api/v1/applications/${id}/status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const contractMutation = useMutation({
    mutationFn: (data: ReturnType<typeof defaultContract>) =>
      api.post(`/api/v1/applications/${id}/contracts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setShowContractForm(false)
    },
  })

  const noteMutation = useMutation({
    mutationFn: (data: { type: string; content: string }) =>
      api.post(`/api/v1/applications/${id}/interactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setNoteContent('')
    },
  })

  const internalNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      api.patch(`/api/v1/applications/${id}`, { internalNotes: notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const scoreMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/applications/${id}/score`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const currentStatus = app.status as ApplicationStatus
  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []
  const contractTotal = computeContractTotal(contract)

  const inputCls =
    'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/collaborator/candidates" className="text-sm text-gray-400 hover:text-gray-600">
              &larr; {t('selection.candidates')}
            </Link>
            <span className="text-lg font-bold">
              {app.athlete.lastName}, {app.athlete.firstName}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                STATUS_COLORS[currentStatus]
              }`}
            >
              {t(`status.${currentStatus}`)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
              </span>
            )}
            {user && (
              <button
                onClick={() => logout()}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                {t('auth.logout')}
              </button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* ── Left column: Athlete info + Scoring ──────────────────────── */}
          <div className="space-y-4">
            {/* Athlete info */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('common.details')}</h3>
              <div className="space-y-2 text-sm">
                <Row label={t('athlete.event')} value={app.event.name} />
                <Row label={t('athlete.nationality')} value={
                  <span className={app.athlete.isSwiss ? 'text-red-600 font-semibold' : app.athlete.isEap ? 'text-blue-600 font-semibold' : ''}>
                    {app.athlete.nationality}
                    {app.athlete.isSwiss && ' (SUI)'}
                    {app.athlete.isEap && ' (EAP)'}
                  </span>
                } />
                <Row label={t('athlete.federation')} value={app.athlete.federation ?? '—'} />
                <Row label={t('athlete.personalBest')} value={
                  <span className="font-mono">{app.personalBest ?? '—'}</span>
                } />
                <Row label={t('athlete.seasonBest')} value={
                  <span className="font-mono">{app.seasonBest ?? '—'}</span>
                } />
                <Row label={t('athlete.worldRanking')} value={
                  app.worldRanking != null ? `#${app.worldRanking}` : '—'
                } />
                {app.athlete.waProfileUrl && (
                  <Row label={t('athlete.waProfile')} value={
                    <a href={app.athlete.waProfileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline text-xs">
                      Profile
                    </a>
                  } />
                )}
                <Row label={t('athlete.email')} value={app.athlete.athleteEmail ?? '—'} />
                <Row label={t('athlete.phone')} value={app.athlete.athletePhone ?? '—'} />
              </div>
            </div>

            {/* Scoring */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{t('selection.scoring')}</h3>
                <button
                  onClick={() => scoreMutation.mutate()}
                  disabled={scoreMutation.isPending}
                  className="text-xs text-gray-500 hover:text-gray-700 border rounded px-2 py-0.5"
                >
                  {scoreMutation.isPending ? '...' : 'Re-score'}
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-bold">
                  {app.score != null ? (app.score * 100).toFixed(0) : '—'}
                </span>
                {app.recommendation && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      {
                        'Highly Recommended': 'bg-green-100 text-green-800',
                        Recommended: 'bg-blue-100 text-blue-700',
                        'Under Review': 'bg-yellow-100 text-yellow-800',
                        'Not Recommended': 'bg-red-100 text-red-800',
                      }[app.recommendation] ?? ''
                    }`}
                  >
                    {app.recommendation}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400">
                {t('selection.estimatedCost')}: CHF {(app.estTotal ?? 0).toLocaleString()}
              </div>
            </div>

            {/* Compliance */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('compliance.title')}</h3>
              <div className="space-y-2 text-sm">
                <Row label={t('compliance.iRunClean')} value={
                  <ComplianceBadge status={app.iRunClean} />
                } />
                <Row label={t('compliance.dopingFree')} value={
                  <ComplianceBadge status={app.dopingFree} />
                } />
              </div>
            </div>

            {/* Internal notes */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-2">{t('common.notes')} (internal)</h3>
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
          </div>

          {/* ── Center column: Contract ──────────────────────────────────── */}
          <div className="space-y-4">
            {/* Status actions */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('common.actions')}</h3>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((status) => {
                  const needsConfirm = ['accepted', 'rejected', 'withdrawn'].includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        if (status === 'contract_sent') {
                          setShowContractForm(true)
                        } else if (needsConfirm) {
                          setConfirmAction(status as ApplicationStatus)
                        } else {
                          statusMutation.mutate(status as ApplicationStatus)
                        }
                      }}
                      disabled={statusMutation.isPending}
                      className={`text-xs px-3 py-1.5 rounded font-medium border ${
                        status === 'accepted'
                          ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                          : status === 'rejected'
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : status === 'withdrawn'
                          ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          : status === 'contract_sent'
                          ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                          : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {t(`status.${status}`)}
                    </button>
                  )
                })}
                {allowedTransitions.length === 0 && (
                  <span className="text-xs text-gray-400">No available actions</span>
                )}
              </div>
              {statusMutation.isError && (
                <p className="text-xs text-red-600 mt-2">{t('common.error')}</p>
              )}

              {/* Confirmation dialog */}
              {confirmAction && (
                <div className="mt-3 p-3 rounded border border-yellow-300 bg-yellow-50">
                  <p className="text-sm text-gray-900 mb-3">
                    {t('confirm.statusChange', {
                      athlete: `${app.athlete.firstName} ${app.athlete.lastName}`,
                      status: t(`status.${confirmAction}`),
                    })}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        statusMutation.mutate(confirmAction)
                        setConfirmAction(null)
                      }}
                      className={`text-xs px-3 py-1.5 rounded font-medium ${
                        confirmAction === 'accepted'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : confirmAction === 'rejected'
                          ? 'bg-red-600 text-white hover:bg-red-700'
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
            </div>

            {/* Contract history */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{t('contract.title')}</h3>
                {!showContractForm && currentStatus !== 'accepted' && currentStatus !== 'rejected' && currentStatus !== 'withdrawn' && (
                  <button
                    onClick={() => setShowContractForm(true)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {latestContract ? 'New version' : t('contract.sendOffer')}
                  </button>
                )}
              </div>

              {app.contracts.length === 0 && !showContractForm ? (
                <p className="text-xs text-gray-400">{t('contract.noOfferYet')}</p>
              ) : (
                <div className="space-y-3">
                  {app.contracts.map((c) => (
                    <ContractCard key={c.id} contract={c} t={t} />
                  ))}
                </div>
              )}
            </div>

            {/* Contract form */}
            {showContractForm && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">
                  {t('contract.sendOffer')} — v{(app.contracts.length || 0) + 1}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={contract.bonus}
                      onChange={(e) =>
                        setContract((p) => ({ ...p, bonus: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('contract.otherCompensation')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={contract.otherCompensation}
                      onChange={(e) =>
                        setContract((p) => ({
                          ...p,
                          otherCompensation: parseInt(e.target.value) || 0,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className={labelCls}>{t('contract.transport')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={contract.transport}
                      onChange={(e) =>
                        setContract((p) => ({ ...p, transport: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="localTransport"
                      checked={contract.localTransport}
                      onChange={(e) =>
                        setContract((p) => ({ ...p, localTransport: e.target.checked }))
                      }
                    />
                    <label htmlFor="localTransport" className="text-sm">
                      {t('contract.localTransport')}
                    </label>
                  </div>

                  {/* Hotel nights */}
                  <div>
                    <label className={labelCls}>
                      {t('contract.hotelNights')} (CHF {HOTEL_COST_PER_NIGHT}/night)
                    </label>
                    <div className="flex gap-2">
                      {NIGHT_LABELS.map((night) => {
                        const key = `hotelNight${night.charAt(0).toUpperCase() + night.slice(1)}` as keyof typeof contract
                        return (
                          <label
                            key={night}
                            className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                              contract[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={contract[key] as boolean}
                              onChange={(e) =>
                                setContract((p) => ({ ...p, [key]: e.target.checked }))
                              }
                            />
                            {t(`night.${night}`)}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{t('contract.catering')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={contract.catering}
                      onChange={(e) =>
                        setContract((p) => ({ ...p, catering: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>

                  <div>
                    <label className={labelCls}>{t('contract.notesToAthlete')}</label>
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={contract.notes}
                      onChange={(e) => setContract((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>

                  {/* Live total */}
                  <div className="flex items-center justify-between py-2 border-t">
                    <span className="text-sm font-semibold">{t('contract.totalCost')}</span>
                    <span className="text-lg font-bold">
                      CHF {contractTotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => contractMutation.mutate(contract)}
                      disabled={contractMutation.isPending}
                      className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {contractMutation.isPending
                        ? t('common.loading')
                        : t('contract.sendOffer')}
                    </button>
                    <button
                      onClick={() => setShowContractForm(false)}
                      className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
                    >
                      {t('common.cancel')}
                    </button>
                  </div>
                  {contractMutation.isError && (
                    <p className="text-xs text-red-600">{t('common.error')}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: Interactions timeline ──────────────────────── */}
          <div className="space-y-4">
            {/* Add interaction */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">Add note</h3>
              <select
                className={`${inputCls} mb-2`}
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as typeof noteType)}
              >
                <option value="note">Note</option>
                <option value="call">Phone call</option>
                <option value="email">Email</option>
              </select>
              <textarea
                className={inputCls}
                rows={3}
                placeholder="Enter note..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
              />
              <button
                onClick={() => {
                  if (noteContent.trim()) {
                    noteMutation.mutate({ type: noteType, content: noteContent })
                  }
                }}
                disabled={noteMutation.isPending || !noteContent.trim()}
                className="mt-2 text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
              >
                {t('common.add')}
              </button>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">Timeline</h3>
              {app.interactions.length === 0 ? (
                <p className="text-xs text-gray-400">No interactions yet</p>
              ) : (
                <div className="space-y-3">
                  {app.interactions.map((interaction) => (
                    <InteractionCard key={interaction.id} interaction={interaction} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-xs text-right">{value}</span>
    </div>
  )
}

function ComplianceBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    yes: 'bg-green-100 text-green-700',
    no: 'bg-red-100 text-red-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    unknown: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[status] ?? colors.unknown}`}>
      {status}
    </span>
  )
}

function ContractCard({ contract: c, t }: { contract: ContractOffer; t: (key: string) => string }) {
  const nights = [
    c.hotelNightTue, c.hotelNightWed, c.hotelNightThu,
    c.hotelNightFri, c.hotelNightSat, c.hotelNightSun,
  ].filter(Boolean).length

  return (
    <div className={`p-3 rounded border text-xs ${
      c.direction === 'to_athlete' ? 'border-blue-200 bg-blue-50' : 'border-purple-200 bg-purple-50'
    }`}>
      <div className="flex justify-between mb-1">
        <span className="font-semibold">
          v{c.version} — {c.direction === 'to_athlete' ? 'To athlete' : 'Counter-offer'}
        </span>
        <span className="text-gray-500">{new Date(c.sentAt).toLocaleDateString()}</span>
      </div>
      <div className="grid grid-cols-2 gap-1 text-gray-600">
        <span>{t('contract.bonus')}: CHF {c.bonus}</span>
        <span>{t('contract.transport')}: CHF {c.transport}</span>
        <span>{t('contract.hotelNights')}: {nights}</span>
        <span>{t('contract.catering')}: CHF {c.catering}</span>
      </div>
      <div className="mt-1 font-semibold text-gray-900">
        {t('contract.totalCost')}: CHF {c.totalCost.toLocaleString()}
      </div>
      {c.notes && <p className="mt-1 text-gray-500 italic">{c.notes}</p>}
    </div>
  )
}

function InteractionCard({ interaction }: { interaction: Interaction }) {
  const typeIcons: Record<string, string> = {
    status_change: '\u25CF',
    contract: '\u25A0',
    counter_offer: '\u25C6',
    note: '\u270E',
    call: '\u260E',
    email: '\u2709',
  }

  const typeColors: Record<string, string> = {
    status_change: 'text-blue-500',
    contract: 'text-green-500',
    counter_offer: 'text-purple-500',
    note: 'text-gray-500',
    call: 'text-orange-500',
    email: 'text-indigo-500',
  }

  return (
    <div className="flex gap-2">
      <span className={`${typeColors[interaction.type] ?? 'text-gray-400'} mt-0.5`}>
        {typeIcons[interaction.type] ?? '\u25CF'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-900">{interaction.content}</p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {interaction.authorName} — {new Date(interaction.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

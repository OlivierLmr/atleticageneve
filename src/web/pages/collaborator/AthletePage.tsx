import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { NEGOTIATION_TRANSITIONS, NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'
import { STATUS_COLORS } from '@web/lib/ui-constants'
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
} from '@shared/types'

// Sibling application (same athlete, different event)
interface SiblingApplication extends Application {
  event: Event & { catalog: EventCatalog }
}

// The application detail API returns event with nested catalog
interface ApplicationDetail extends Application {
  athlete: Athlete
  event: Event & { catalog: EventCatalog }
  agreements: Agreement[]
  interactions: Interaction[]
  waPerformance?: WaPerformance | null
  siblingApplications: SiblingApplication[]
}

// Hotels API returns hotels with rooms sub-items
interface HotelWithRooms extends Hotel {
  rooms: HotelRoom[]
}

interface StaffUser {
  id: string
  firstName: string
  lastName: string
  role: string
}

// ── Agreement editor defaults ────────────────────────────────────────────────

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

// ── Main page ────────────────────────────────────────────────────────────────

export default function AthletePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: app, isLoading } = useQuery<ApplicationDetail>({
    queryKey: ['application', id],
    queryFn: () => api.get(`/api/v1/applications/${id}`),
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

  const { data: edition } = useQuery<{
    stadiumMealCost: number
    transportAirportHotelCost: number
    transportHotelStadiumCost: number
  }>({
    queryKey: ['edition-current'],
    queryFn: () => api.get('/api/v1/editions/current'),
  })

  // Flatten hotel rooms for the dropdown
  const allRooms = hotels.flatMap(h => h.rooms.map(r => ({ ...r, hotelName: h.name })))

  // Agreement form state
  const latestAgreement = app?.agreements?.length
    ? app.agreements[app.agreements.length - 1]
    : undefined
  const [agreement, setAgreement] = useState(() => defaultAgreement(latestAgreement))
  const [showAgreementForm, setShowAgreementForm] = useState(false)

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<NegotiationStatus | null>(null)

  // Note form
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email'>('note')
  const [noteContent, setNoteContent] = useState('')

  // Internal notes (on athlete)
  const [internalNotes, setInternalNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)

  // Collapsible sections
  const [openSection, setOpenSection] = useState<string | null>(null)

  // WA Performance edit
  const [editingPerf, setEditingPerf] = useState(false)
  const [perfForm, setPerfForm] = useState({ personalBest: '', seasonBest: '', worldRanking: '' })

  // Initialize from fetched data
  if (app && !notesInitialized) {
    setInternalNotes(app.athlete.internalNotes ?? '')
    if (latestAgreement) {
      setAgreement(defaultAgreement(latestAgreement))
    }
    setNotesInitialized(true)
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  const statusMutation = useMutation({
    mutationFn: (status: NegotiationStatus) =>
      api.patch(`/api/v1/athletes/${app?.athleteId}/negotiation-status`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const agreementMutation = useMutation({
    mutationFn: (data: ReturnType<typeof defaultAgreement>) =>
      api.post(`/api/v1/athletes/${app?.athleteId}/agreements`, {
        ...data,
        hotelRoomId: data.hotelRoomId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setShowAgreementForm(false)
    },
  })

  const noteMutation = useMutation({
    mutationFn: (data: { type: string; content: string }) =>
      api.post(`/api/v1/athletes/${app?.athleteId}/interactions`, {
        ...data,
        applicationId: id,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setNoteContent('')
    },
  })

  const internalNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      api.patch(`/api/v1/athletes/${app?.athleteId}`, { internalNotes: notes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const participationMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      api.patch(`/api/v1/applications/${appId}/participation-status`, { participationStatus: status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const scoreMutation = useMutation({
    mutationFn: () => api.post(`/api/v1/applications/${id}/score`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const athleteUpdateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/api/v1/athletes/${app?.athleteId}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['application', id] }),
  })

  const waPerfMutation = useMutation({
    mutationFn: (data: { athleteId: string; eventId: string; personalBest?: number; seasonBest?: number; worldRanking?: number }) =>
      api.post('/api/v1/wa-performance', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application', id] })
      setEditingPerf(false)
    },
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/athletes/${app?.athleteId}`),
    onSuccess: () => navigate(user?.role === 'committee' ? '/committee/candidates' : '/collaborator/candidates'),
  })

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading || !app) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const currentStatus = app.athlete.negotiationStatus as NegotiationStatus
  const allowedTransitions = NEGOTIATION_TRANSITIONS[currentStatus] ?? []
  const allDecided = app.siblingApplications?.length > 0 && app.siblingApplications.every(s => s.participationStatus !== 'pending')

  const inputCls =
    'w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900'
  const labelCls = 'block text-xs font-medium text-gray-500 mb-1'

  const toggleSection = (name: string) => setOpenSection(openSection === name ? null : name)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to={user?.role === 'committee' ? '/committee/candidates' : '/collaborator/candidates'} className="text-sm text-gray-400 hover:text-gray-600">
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
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-3 gap-6">
          {/* ── Left column: Athlete info + Scoring + Editors ─────────── */}
          <div className="space-y-4">
            {/* Athlete info */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('common.details')}</h3>
              <div className="space-y-2 text-sm">
                <Row label={t('athlete.event')} value={app.event.catalog.name} />
                <Row label={t('athlete.nationality')} value={
                  <span className={app.athlete.isSwiss ? 'text-red-600 font-semibold' : app.athlete.isEap ? 'text-blue-600 font-semibold' : ''}>
                    {app.athlete.nationality}
                    {app.athlete.isSwiss && ' (SUI)'}
                    {app.athlete.isEap && ' (EAP)'}
                  </span>
                } />
                <Row label={t('athlete.federation')} value={app.athlete.federation ?? '—'} />
                {/* Performance with edit toggle */}
                {editingPerf ? (
                  <div className="space-y-1 pt-1 border-t">
                    <div>
                      <label className={labelCls}>{t('athlete.personalBest')}</label>
                      <input type="number" step="0.01" className={inputCls} value={perfForm.personalBest}
                        onChange={e => setPerfForm(p => ({ ...p, personalBest: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('athlete.seasonBest')}</label>
                      <input type="number" step="0.01" className={inputCls} value={perfForm.seasonBest}
                        onChange={e => setPerfForm(p => ({ ...p, seasonBest: e.target.value }))} />
                    </div>
                    <div>
                      <label className={labelCls}>{t('athlete.worldRanking')}</label>
                      <input type="number" className={inputCls} value={perfForm.worldRanking}
                        onChange={e => setPerfForm(p => ({ ...p, worldRanking: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          waPerfMutation.mutate({
                            athleteId: app.athleteId,
                            eventId: app.eventId,
                            ...(perfForm.personalBest ? { personalBest: parseFloat(perfForm.personalBest) } : {}),
                            ...(perfForm.seasonBest ? { seasonBest: parseFloat(perfForm.seasonBest) } : {}),
                            ...(perfForm.worldRanking ? { worldRanking: parseInt(perfForm.worldRanking) } : {}),
                          })
                        }}
                        disabled={waPerfMutation.isPending}
                        className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
                      >
                        {t('common.save')}
                      </button>
                      <button onClick={() => setEditingPerf(false)} className="text-xs text-gray-400 hover:text-gray-600">
                        {t('common.cancel')}
                      </button>
                    </div>
                    {waPerfMutation.isError && (
                      <p className="text-xs text-red-600">{(waPerfMutation.error as Error)?.message || t('common.error')}</p>
                    )}
                  </div>
                ) : (
                  <>
                    {app.waPerformance ? (
                      <>
                        <Row label={t('athlete.personalBest')} value={
                          <span className="font-mono">{app.waPerformance.personalBest ?? '—'}</span>
                        } />
                        <Row label={t('athlete.seasonBest')} value={
                          <span className="font-mono">{app.waPerformance.seasonBest ?? '—'}</span>
                        } />
                        <Row label={t('athlete.worldRanking')} value={
                          app.waPerformance.worldRanking != null ? `#${app.waPerformance.worldRanking}` : '—'
                        } />
                      </>
                    ) : (
                      <>
                        <Row label={t('athlete.personalBest')} value={
                          <span className="font-mono">{app.personalBest ?? '—'}</span>
                        } />
                        <Row label={t('athlete.seasonBest')} value={
                          <span className="font-mono">{app.seasonBest ?? '—'}</span>
                        } />
                        <Row label={t('athlete.worldRanking')} value={
                          app.worldRanking != null ? `#${app.worldRanking}` : '—'
                        } />
                      </>
                    )}
                    <button
                      onClick={() => {
                        const wp = app.waPerformance
                        setPerfForm({
                          personalBest: wp?.personalBest != null ? String(wp.personalBest) : '',
                          seasonBest: wp?.seasonBest != null ? String(wp.seasonBest) : '',
                          worldRanking: wp?.worldRanking != null ? String(wp.worldRanking) : '',
                        })
                        setEditingPerf(true)
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 mt-1"
                    >
                      Edit performance
                    </button>
                  </>
                )}
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
                {t('selection.estimatedCost')}: CHF {(app.athlete.estTotal ?? 0).toLocaleString()}
              </div>
            </div>

            {/* ── Collapsible editor sections ──────────────────────────── */}

            {/* Personal data */}
            <CollapsibleSection title="Personal Data" isOpen={openSection === 'personal'} onToggle={() => toggleSection('personal')}>
              <AthleteFieldEditor
                athlete={app.athlete}
                fields={[
                  { key: 'firstName', label: t('athlete.firstName'), type: 'text' },
                  { key: 'lastName', label: t('athlete.lastName'), type: 'text' },
                  { key: 'dateOfBirth', label: t('athlete.dateOfBirth'), type: 'date' },
                  { key: 'nationality', label: t('athlete.nationality'), type: 'text' },
                  { key: 'gender', label: t('athlete.gender'), type: 'select', options: [{ value: 'M', label: t('athlete.male') }, { value: 'F', label: t('athlete.female') }] },
                  { key: 'federation', label: t('athlete.federation'), type: 'text' },
                  { key: 'athleteEmail', label: t('athlete.email'), type: 'text' },
                  { key: 'athletePhone', label: t('athlete.phone'), type: 'text' },
                  { key: 'waProfileUrl', label: t('athlete.waProfile'), type: 'text' },
                  { key: 'swiLicence', label: t('athlete.swissLicence'), type: 'text' },
                  { key: 'honours', label: 'Honours', type: 'text' },
                  { key: 'distanceFromGva', label: 'Distance from GVA (km)', type: 'number' },
                  { key: 'isEap', label: t('athlete.eapMember'), type: 'checkbox' },
                  { key: 'isSwiss', label: 'Swiss', type: 'checkbox' },
                  { key: 'eapCity', label: 'EAP City', type: 'text' },
                ]}
                onSave={(data) => athleteUpdateMutation.mutate(data)}
                isPending={athleteUpdateMutation.isPending}
                error={athleteUpdateMutation.error}
                t={t}
              />
            </CollapsibleSection>

            {/* Compliance */}
            <CollapsibleSection title={t('compliance.title')} isOpen={openSection === 'compliance'} onToggle={() => toggleSection('compliance')}>
              <AthleteFieldEditor
                athlete={app.athlete}
                fields={[
                  { key: 'iRunClean', label: t('compliance.iRunClean'), type: 'select', options: [
                    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' },
                    { value: 'in_progress', label: 'In progress' }, { value: 'unknown', label: 'Unknown' },
                  ]},
                  { key: 'dopingFree', label: t('compliance.dopingFree'), type: 'select', options: [
                    { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' },
                  ]},
                ]}
                onSave={(data) => athleteUpdateMutation.mutate(data)}
                isPending={athleteUpdateMutation.isPending}
                error={athleteUpdateMutation.error}
                t={t}
              />
            </CollapsibleSection>

            {/* Logistics */}
            <CollapsibleSection title={t('logistics.title')} isOpen={openSection === 'logistics'} onToggle={() => toggleSection('logistics')}>
              <AthleteFieldEditor
                athlete={app.athlete}
                fields={[
                  { key: 'arrivalDate', label: `${t('logistics.arrival')} ${t('logistics.date')}`, type: 'date' },
                  { key: 'arrivalFlight', label: `${t('logistics.arrival')} ${t('logistics.flightNumber')}`, type: 'text' },
                  { key: 'arrivalFrom', label: `${t('logistics.arrival')} ${t('logistics.from')}`, type: 'text' },
                  { key: 'arrivalTime', label: `${t('logistics.arrival')} ${t('logistics.time')}`, type: 'text' },
                  { key: 'departureDate', label: `${t('logistics.departure')} ${t('logistics.date')}`, type: 'date' },
                  { key: 'departureFlight', label: `${t('logistics.departure')} ${t('logistics.flightNumber')}`, type: 'text' },
                  { key: 'departureTo', label: `${t('logistics.departure')} ${t('logistics.to')}`, type: 'text' },
                  { key: 'departureTime', label: `${t('logistics.departure')} ${t('logistics.time')}`, type: 'text' },
                  { key: 'accommodationReqs', label: t('logistics.specialRequests'), type: 'textarea' },
                ]}
                onSave={(data) => athleteUpdateMutation.mutate(data)}
                isPending={athleteUpdateMutation.isPending}
                error={athleteUpdateMutation.error}
                t={t}
              />
            </CollapsibleSection>

            {/* Cost estimates */}
            <CollapsibleSection title={t('selection.estimatedCost')} isOpen={openSection === 'costs'} onToggle={() => toggleSection('costs')}>
              <AthleteFieldEditor
                athlete={app.athlete}
                fields={[
                  { key: 'estTravel', label: 'Est. travel (CHF)', type: 'number' },
                  { key: 'estAccommodation', label: 'Est. accommodation (CHF)', type: 'number' },
                  { key: 'estAppearance', label: 'Est. appearance (CHF)', type: 'number' },
                ]}
                onSave={(data) => athleteUpdateMutation.mutate(data)}
                isPending={athleteUpdateMutation.isPending}
                error={athleteUpdateMutation.error}
                t={t}
              />
              <p className="text-xs text-gray-400 mt-1">Total auto-computed as sum of the three fields.</p>
            </CollapsibleSection>

            {/* Assigned selector */}
            <CollapsibleSection title={t('selection.assignedSelector')} isOpen={openSection === 'selector'} onToggle={() => toggleSection('selector')}>
              <SelectorAssign
                currentValue={app.athlete.assignedSelector}
                staffUsers={staffUsers}
                onSave={(val) => athleteUpdateMutation.mutate({ assignedSelector: val || null })}
                isPending={athleteUpdateMutation.isPending}
                t={t}
              />
            </CollapsibleSection>

            {/* Payment */}
            <CollapsibleSection title="Payment" isOpen={openSection === 'payment'} onToggle={() => toggleSection('payment')}>
              <AthleteFieldEditor
                athlete={app.athlete}
                fields={[
                  { key: 'bankIban', label: 'IBAN', type: 'text' },
                  { key: 'paymentStatus', label: 'Payment status', type: 'select', options: [
                    { value: 'pending', label: 'Pending' }, { value: 'done', label: 'Done' },
                  ]},
                  { key: 'paymentAmount', label: 'Amount (CHF)', type: 'number' },
                  { key: 'paymentDate', label: 'Payment date', type: 'date' },
                  { key: 'paymentMethod', label: 'Method', type: 'select', options: [
                    { value: '', label: '—' }, { value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank' },
                    { value: 'western_union', label: 'Western Union' }, { value: 'paypal', label: 'PayPal' }, { value: 'other', label: 'Other' },
                  ]},
                ]}
                onSave={(data) => athleteUpdateMutation.mutate(data)}
                isPending={athleteUpdateMutation.isPending}
                error={athleteUpdateMutation.error}
                t={t}
              />
            </CollapsibleSection>

            {/* Notes */}
            <CollapsibleSection title={t('common.notes')} isOpen={openSection === 'notes'} onToggle={() => toggleSection('notes')}>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Participant notes</label>
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded min-h-[2rem]">{app.athlete.participantNotes || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Additional notes</label>
                  <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded min-h-[2rem]">{app.athlete.additionalNotes || '—'}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Internal notes (staff only)</label>
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
            </CollapsibleSection>
          </div>

          {/* ── Center column: Agreement ──────────────────────────────── */}
          <div className="space-y-4">
            {/* Status actions */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('common.actions')}</h3>
              <div className="flex flex-wrap gap-2">
                {allowedTransitions.map((status) => {
                  const needsConfirm = ['confirmed', 'rejected', 'withdrawn'].includes(status)
                  return (
                    <button
                      key={status}
                      onClick={() => {
                        if (status === 'agreement_sent') {
                          setShowAgreementForm(true)
                        } else if (needsConfirm) {
                          setConfirmAction(status as NegotiationStatus)
                        } else {
                          statusMutation.mutate(status as NegotiationStatus)
                        }
                      }}
                      disabled={statusMutation.isPending}
                      className={`text-xs px-3 py-1.5 rounded font-medium border ${
                        status === 'confirmed'
                          ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                          : status === 'rejected'
                          ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                          : status === 'withdrawn'
                          ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                          : status === 'agreement_sent'
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
                <p className="text-xs text-red-600 mt-2">{(statusMutation.error as Error)?.message || t('common.error')}</p>
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
                        confirmAction === 'confirmed'
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

            {/* Participation status per event */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-sm mb-3">{t('selection.participation')}</h3>
              <div className="space-y-2">
                {(app.siblingApplications ?? []).map((sib) => {
                  const isCurrent = sib.id === id
                  return (
                    <div key={sib.id} className={`flex items-center justify-between text-sm p-2 rounded ${isCurrent ? 'bg-gray-50 border border-gray-200' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs">{sib.event.catalog.name}</span>
                        {isCurrent && <span className="text-[10px] text-gray-400">(current)</span>}
                      </div>
                      <div className="flex gap-1">
                        {(['pending', 'selected', 'not_selected'] as const).map((status) => (
                          <button
                            key={status}
                            onClick={() => {
                              if (sib.participationStatus !== status) {
                                participationMutation.mutate({ appId: sib.id, status })
                              }
                            }}
                            disabled={participationMutation.isPending || sib.participationStatus === status}
                            className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                              sib.participationStatus === status
                                ? status === 'selected'
                                  ? 'bg-green-600 text-white border-green-600'
                                  : status === 'not_selected'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                            }`}
                          >
                            {status === 'not_selected' ? 'Not selected' : status.charAt(0).toUpperCase() + status.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {participationMutation.isError && (
                <p className="text-xs text-red-600 mt-2">{(participationMutation.error as Error)?.message || t('common.error')}</p>
              )}
              {allDecided && (
                <p className="text-xs text-green-600 mt-2">All events decided — ready to send agreement</p>
              )}
              {app.siblingApplications?.length > 0 && !allDecided && (
                <p className="text-xs text-gray-400 mt-2">Decide all events before sending an agreement</p>
              )}
            </div>

            {/* Agreement history */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">{t('contract.title')}</h3>
                {!showAgreementForm && currentStatus !== 'confirmed' && currentStatus !== 'rejected' && currentStatus !== 'withdrawn' && (
                  <button
                    onClick={() => setShowAgreementForm(true)}
                    disabled={!allDecided}
                    className={`text-xs ${allDecided ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 cursor-not-allowed'}`}
                  >
                    {latestAgreement ? 'New version' : t('contract.sendOffer')}
                  </button>
                )}
              </div>

              {app.agreements.length === 0 && !showAgreementForm ? (
                <p className="text-xs text-gray-400">{t('contract.noOfferYet')}</p>
              ) : (
                <div className="space-y-3">
                  {app.agreements.map((c) => (
                    <AgreementCard key={c.id} agreement={c} t={t} />
                  ))}
                </div>
              )}
            </div>

            {/* Agreement form */}
            {showAgreementForm && (
              <div className="bg-white rounded-lg border p-4">
                <h3 className="font-semibold text-sm mb-3">
                  {t('contract.sendOffer')} — v{(app.agreements.length || 0) + 1}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={agreement.appearanceFee}
                      onChange={(e) =>
                        setAgreement((p) => ({ ...p, appearanceFee: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{t('contract.otherCompensation')} (CHF)</label>
                      <input
                        type="number"
                        className={inputCls}
                        value={agreement.otherCompensation}
                        onChange={(e) =>
                          setAgreement((p) => ({
                            ...p,
                            otherCompensation: parseInt(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Description</label>
                      <input
                        className={inputCls}
                        value={agreement.otherCompensationDesc}
                        onChange={(e) =>
                          setAgreement((p) => ({ ...p, otherCompensationDesc: e.target.value }))
                        }
                        placeholder="e.g. pacemaker fee"
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>{t('contract.transport')} (CHF)</label>
                    <input
                      type="number"
                      className={inputCls}
                      value={agreement.transport}
                      onChange={(e) =>
                        setAgreement((p) => ({ ...p, transport: parseInt(e.target.value) || 0 }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreement.transportAirportHotel}
                        onChange={(e) =>
                          setAgreement((p) => ({ ...p, transportAirportHotel: e.target.checked }))
                        }
                      />
                      Airport &rarr; Hotel
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={agreement.transportHotelStadium}
                        onChange={(e) =>
                          setAgreement((p) => ({ ...p, transportHotelStadium: e.target.checked }))
                        }
                      />
                      Hotel &rarr; Stadium
                    </label>
                  </div>

                  {/* Hotel room */}
                  <div>
                    <label className={labelCls}>{t('logistics.hotel')} Room</label>
                    <select
                      className={inputCls}
                      value={agreement.hotelRoomId}
                      onChange={(e) => setAgreement((p) => ({ ...p, hotelRoomId: e.target.value }))}
                    >
                      <option value="">— No hotel room —</option>
                      {allRooms.map(r => (
                        <option key={r.id} value={r.id}>{r.hotelName} — {r.roomType} (CHF {r.costPerNight}/night)</option>
                      ))}
                    </select>
                  </div>

                  {/* Hotel nights */}
                  <div>
                    <label className={labelCls}>{t('contract.hotelNights')}</label>
                    <div className="flex gap-2">
                      {NIGHT_LABELS.map((night) => {
                        const key = `hotelNight${night.charAt(0).toUpperCase() + night.slice(1)}` as keyof typeof agreement
                        return (
                          <label
                            key={night}
                            className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                              agreement[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={agreement[key] as boolean}
                              onChange={(e) =>
                                setAgreement((p) => ({ ...p, [key]: e.target.checked }))
                              }
                            />
                            {t(`night.${night}`)}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Dinners */}
                  <div>
                    <label className={labelCls}>Dinners</label>
                    <div className="flex gap-2">
                      {DINNER_LABELS.map((day) => {
                        const key = `dinner${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof typeof agreement
                        return (
                          <label
                            key={day}
                            className={`flex flex-col items-center text-xs cursor-pointer px-2 py-1 rounded border ${
                              agreement[key] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={agreement[key] as boolean}
                              onChange={(e) =>
                                setAgreement((p) => ({ ...p, [key]: e.target.checked }))
                              }
                            />
                            {t(`night.${day}`)}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Stadium meals */}
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={agreement.stadiumMeals}
                      onChange={(e) =>
                        setAgreement((p) => ({ ...p, stadiumMeals: e.target.checked }))
                      }
                    />
                    Stadium meals
                  </label>

                  <div>
                    <label className={labelCls}>{t('contract.notesToAthlete')}</label>
                    <textarea
                      className={inputCls}
                      rows={2}
                      value={agreement.notes}
                      onChange={(e) => setAgreement((p) => ({ ...p, notes: e.target.value }))}
                    />
                  </div>

                  {/* Live total cost preview */}
                  {(() => {
                    const room = allRooms.find(r => r.id === agreement.hotelRoomId)
                    const nights = [
                      agreement.hotelNightTue, agreement.hotelNightWed, agreement.hotelNightThu,
                      agreement.hotelNightFri, agreement.hotelNightSat, agreement.hotelNightSun,
                    ].filter(Boolean).length
                    const dinners = [
                      agreement.dinnerTue, agreement.dinnerWed, agreement.dinnerThu,
                      agreement.dinnerFri, agreement.dinnerSat, agreement.dinnerSun,
                    ].filter(Boolean).length
                    let total = agreement.appearanceFee + agreement.otherCompensation + agreement.transport
                    total += nights * (room?.costPerNight ?? 0)
                    total += dinners * (room?.dinnerCost ?? 0)
                    if (agreement.stadiumMeals) total += edition?.stadiumMealCost ?? 0
                    if (agreement.transportAirportHotel) total += edition?.transportAirportHotelCost ?? 0
                    if (agreement.transportHotelStadium) total += edition?.transportHotelStadiumCost ?? 0
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
                      onClick={() => agreementMutation.mutate(agreement)}
                      disabled={agreementMutation.isPending}
                      className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {agreementMutation.isPending
                        ? t('common.loading')
                        : t('contract.sendOffer')}
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

          {/* ── Right column: Interactions timeline ──────────────────── */}
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

        {/* Archive button — committee only */}
        {user?.role === 'committee' && !app.athlete.archivedAt && (
          <div className="mt-6 text-right">
            <button
              onClick={() => {
                if (confirm(`Archive ${app.athlete.firstName} ${app.athlete.lastName}? This will hide them from all lists.`)) {
                  archiveMutation.mutate()
                }
              }}
              disabled={archiveMutation.isPending}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
            >
              Archive athlete
            </button>
            {archiveMutation.isError && (
              <p className="text-xs text-red-600 mt-1">{(archiveMutation.error as Error)?.message || t('common.error')}</p>
            )}
          </div>
        )}
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

function CollapsibleSection({ title, isOpen, onToggle, children }: {
  title: string; isOpen: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-gray-50">
        {title}
        <span className="text-gray-400 text-xs">{isOpen ? '▾' : '▸'}</span>
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
        <option value="">— Unassigned —</option>
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

function AgreementCard({ agreement: c, t }: { agreement: Agreement; t: (key: string) => string }) {
  const nights = [
    c.hotelNightTue, c.hotelNightWed, c.hotelNightThu,
    c.hotelNightFri, c.hotelNightSat, c.hotelNightSun,
  ].filter(Boolean).length

  const dinners = [
    c.dinnerTue, c.dinnerWed, c.dinnerThu,
    c.dinnerFri, c.dinnerSat, c.dinnerSun,
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
        <span>{t('contract.bonus')}: CHF {c.appearanceFee}</span>
        <span>{t('contract.transport')}: CHF {c.transport}</span>
        <span>{t('contract.hotelNights')}: {nights}</span>
        <span>Dinners: {dinners}</span>
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
    agreement: '\u25A0',
    counter_offer: '\u25C6',
    note: '\u270E',
    call: '\u260E',
    email: '\u2709',
  }

  const typeColors: Record<string, string> = {
    status_change: 'text-blue-500',
    agreement: 'text-green-500',
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

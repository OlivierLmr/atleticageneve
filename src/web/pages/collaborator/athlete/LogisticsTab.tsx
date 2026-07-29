import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { inputCls } from '@web/lib/ui-constants'
import type { AthleteDetail, TravelMode } from '@shared/types'

const rowInputCls =
  'w-full px-1.5 py-0.5 border border-gray-300 rounded text-xs text-right focus:outline-none focus:ring-1 focus:ring-gray-900'

type LogisticsForm = {
  arrivalTravelMode: TravelMode
  arrivalDate: string
  arrivalFlight: string
  arrivalFrom: string
  arrivalTime: string
  departureTravelMode: TravelMode
  departureDate: string
  departureFlight: string
  departureTo: string
  departureTime: string
  accommodationReqs: string
}

function formFromAthlete(athlete: AthleteDetail): LogisticsForm {
  return {
    arrivalTravelMode: athlete.arrivalTravelMode,
    arrivalDate: athlete.arrivalDate ?? '',
    arrivalFlight: athlete.arrivalFlight ?? '',
    arrivalFrom: athlete.arrivalFrom ?? '',
    arrivalTime: athlete.arrivalTime ?? '',
    departureTravelMode: athlete.departureTravelMode,
    departureDate: athlete.departureDate ?? '',
    departureFlight: athlete.departureFlight ?? '',
    departureTo: athlete.departureTo ?? '',
    departureTime: athlete.departureTime ?? '',
    accommodationReqs: athlete.accommodationReqs ?? '',
  }
}

// A row keeps the exact same label/value layout whether it is being viewed or
// edited — only the right-hand cell swaps between static text and an input,
// so toggling edit mode never reshuffles the presentation.
function Row({ label, isEditing, viewValue, children }: {
  label: string
  isEditing: boolean
  viewValue: string
  children: ReactNode
}) {
  return (
    <div className="flex justify-between items-center gap-3 text-xs py-1">
      <span className="text-gray-500 shrink-0">{label}</span>
      {isEditing
        ? <span className="w-1/2">{children}</span>
        : <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{viewValue || '—'}</span>}
    </div>
  )
}

export function LogisticsTab({ athlete, isStaff, isAthleteOrManager, mutations }: {
  athlete: AthleteDetail
  isStaff: boolean
  isAthleteOrManager: boolean
  mutations: {
    athleteUpdate: { mutate: (data: Record<string, unknown>, options?: { onSuccess?: () => void }) => void; isPending: boolean; error: Error | null }
  }
}) {
  const { t } = useTranslation()
  const canEdit = isStaff || isAthleteOrManager
  const [isEditing, setIsEditing] = useState(false)
  const [form, setForm] = useState<LogisticsForm>(() => formFromAthlete(athlete))

  // Keep the form in sync with fresh athlete data as long as the user isn't
  // mid-edit (a save success also flips isEditing off, so this then re-syncs).
  useEffect(() => {
    if (!isEditing) setForm(formFromAthlete(athlete))
  }, [athlete, isEditing])

  const set = <K extends keyof LogisticsForm>(key: K, value: LogisticsForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const travelModeOptions: { value: TravelMode; label: string }[] = [
    { value: 'plane', label: t('logistics.byPlane') },
    { value: 'train', label: t('logistics.byTrain') },
    { value: 'road', label: t('logistics.byRoad') },
  ]
  const travelModeLabel = (mode: TravelMode) => travelModeOptions.find(o => o.value === mode)?.label ?? mode

  const handleSave = () => {
    mutations.athleteUpdate.mutate(
      {
        arrivalTravelMode: form.arrivalTravelMode,
        arrivalDate: form.arrivalDate || null,
        arrivalFlight: form.arrivalTravelMode === 'plane' ? (form.arrivalFlight || null) : null,
        arrivalFrom: form.arrivalFrom || null,
        arrivalTime: form.arrivalTime || null,
        departureTravelMode: form.departureTravelMode,
        departureDate: form.departureDate || null,
        departureFlight: form.departureTravelMode === 'plane' ? (form.departureFlight || null) : null,
        departureTo: form.departureTo || null,
        departureTime: form.departureTime || null,
        accommodationReqs: form.accommodationReqs || null,
      },
      { onSuccess: () => setIsEditing(false) },
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('logistics.title')}</h2>
        {canEdit && (
          <button
            onClick={() => {
              if (isEditing) setForm(formFromAthlete(athlete))
              setIsEditing(e => !e)
            }}
            className={`text-xs px-2 py-1 rounded ${isEditing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {isEditing ? t('common.cancelEdit') : t('common.edit')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.arrival')}</h3>
          <Row label={t('logistics.travelMode')} isEditing={isEditing} viewValue={travelModeLabel(form.arrivalTravelMode)}>
            <select className={rowInputCls} value={form.arrivalTravelMode} onChange={e => set('arrivalTravelMode', e.target.value as TravelMode)}>
              {travelModeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
          <Row label={t('logistics.date')} isEditing={isEditing} viewValue={form.arrivalDate}>
            <input type="date" className={rowInputCls} value={form.arrivalDate} onChange={e => set('arrivalDate', e.target.value)} />
          </Row>
          {form.arrivalTravelMode === 'plane' && (
            <Row label={t('logistics.flightNumber')} isEditing={isEditing} viewValue={form.arrivalFlight}>
              <input type="text" className={rowInputCls} value={form.arrivalFlight} onChange={e => set('arrivalFlight', e.target.value)} />
            </Row>
          )}
          <Row label={t('logistics.from')} isEditing={isEditing} viewValue={form.arrivalFrom}>
            <input type="text" className={rowInputCls} value={form.arrivalFrom} onChange={e => set('arrivalFrom', e.target.value)} />
          </Row>
          <Row label={t('logistics.time')} isEditing={isEditing} viewValue={form.arrivalTime}>
            <input type="text" className={rowInputCls} value={form.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} />
          </Row>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.departure')}</h3>
          <Row label={t('logistics.travelMode')} isEditing={isEditing} viewValue={travelModeLabel(form.departureTravelMode)}>
            <select className={rowInputCls} value={form.departureTravelMode} onChange={e => set('departureTravelMode', e.target.value as TravelMode)}>
              {travelModeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Row>
          <Row label={t('logistics.date')} isEditing={isEditing} viewValue={form.departureDate}>
            <input type="date" className={rowInputCls} value={form.departureDate} onChange={e => set('departureDate', e.target.value)} />
          </Row>
          {form.departureTravelMode === 'plane' && (
            <Row label={t('logistics.flightNumber')} isEditing={isEditing} viewValue={form.departureFlight}>
              <input type="text" className={rowInputCls} value={form.departureFlight} onChange={e => set('departureFlight', e.target.value)} />
            </Row>
          )}
          <Row label={t('logistics.to')} isEditing={isEditing} viewValue={form.departureTo}>
            <input type="text" className={rowInputCls} value={form.departureTo} onChange={e => set('departureTo', e.target.value)} />
          </Row>
          <Row label={t('logistics.time')} isEditing={isEditing} viewValue={form.departureTime}>
            <input type="text" className={rowInputCls} value={form.departureTime} onChange={e => set('departureTime', e.target.value)} />
          </Row>
        </div>

        <div className="bg-white rounded-lg border p-4 col-span-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.specialRequests')}</h3>
          {isEditing ? (
            <textarea className={inputCls} rows={3} value={form.accommodationReqs} onChange={e => set('accommodationReqs', e.target.value)} />
          ) : (
            <p className="text-xs text-gray-900 whitespace-pre-wrap">{form.accommodationReqs || '—'}</p>
          )}
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={mutations.athleteUpdate.isPending}
            className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {t('common.save')}
          </button>
          {mutations.athleteUpdate.error && (
            <p className="text-xs text-red-600">{mutations.athleteUpdate.error.message || t('common.error')}</p>
          )}
        </div>
      )}
    </div>
  )
}

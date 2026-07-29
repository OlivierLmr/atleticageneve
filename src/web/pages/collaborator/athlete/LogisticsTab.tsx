import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AthleteDetail } from '@shared/types'
import type { FieldDef } from './types'
import { FieldReadOnly, AthleteFieldEditor } from './components'

export function LogisticsTab({ athlete, isStaff, mutations }: {
  athlete: AthleteDetail
  isStaff: boolean
  mutations: {
    athleteUpdate: { mutate: (data: Record<string, unknown>, options?: { onSuccess?: () => void }) => void; isPending: boolean; error: Error | null }
  }
}) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)

  const arrivalFields: FieldDef[] = [
    { key: 'arrivalDate', label: t('logistics.date'), type: 'date' },
    { key: 'arrivalFlight', label: t('logistics.flightNumber'), type: 'text' },
    { key: 'arrivalFrom', label: t('logistics.from'), type: 'text' },
    { key: 'arrivalTime', label: t('logistics.time'), type: 'text' },
  ]

  const departureFields: FieldDef[] = [
    { key: 'departureDate', label: t('logistics.date'), type: 'date' },
    { key: 'departureFlight', label: t('logistics.flightNumber'), type: 'text' },
    { key: 'departureTo', label: t('logistics.to'), type: 'text' },
    { key: 'departureTime', label: t('logistics.time'), type: 'text' },
  ]

  const requestFields: FieldDef[] = [
    { key: 'accommodationReqs', label: t('logistics.specialRequests'), type: 'textarea' },
  ]

  const allFields = [...arrivalFields, ...departureFields, ...requestFields]

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900">{t('logistics.title')}</h2>
        {isStaff && (
          <button
            onClick={() => setIsEditing(e => !e)}
            className={`text-xs px-2 py-1 rounded ${isEditing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
          >
            {isEditing ? t('common.cancelEdit') : t('common.edit')}
          </button>
        )}
      </div>

      {isEditing && isStaff ? (
        <div className="bg-white rounded-lg border p-4">
          <AthleteFieldEditor
            athlete={athlete}
            fields={allFields}
            onSave={(data) => mutations.athleteUpdate.mutate(data, { onSuccess: () => setIsEditing(false) })}
            isPending={mutations.athleteUpdate.isPending}
            error={mutations.athleteUpdate.error}
            t={t}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.arrival')}</h3>
            <FieldReadOnly athlete={athlete} fields={arrivalFields} t={t} />
          </div>
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.departure')}</h3>
            <FieldReadOnly athlete={athlete} fields={departureFields} t={t} />
          </div>
          <div className="bg-white rounded-lg border p-4 col-span-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('logistics.specialRequests')}</h3>
            <p className="text-xs text-gray-900 whitespace-pre-wrap">{athlete.accommodationReqs || '—'}</p>
          </div>
        </div>
      )}
    </div>
  )
}

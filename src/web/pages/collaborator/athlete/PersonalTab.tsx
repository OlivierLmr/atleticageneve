import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { inputCls } from '@web/lib/ui-constants'
import type { AthleteDetail, EapCity } from '@shared/types'
import type { FieldDef, StaffUser } from './types'
import { CollapsibleSection, FieldReadOnly, AthleteFieldEditor, SelectorAssign } from './components'

export function PersonalTab({ athlete, isStaff, isAthleteOrManager, staffUsers, eapCities, mutations }: {
  athlete: AthleteDetail
  isStaff: boolean
  isAthleteOrManager: boolean
  staffUsers: StaffUser[]
  eapCities: EapCity[]
  mutations: {
    athleteUpdate: { mutate: (data: Record<string, unknown>, options?: { onSuccess?: () => void }) => void; isPending: boolean; error: Error | null }
    internalNotes: { mutate: (notes: string) => void; isPending: boolean }
  }
}) {
  const { t } = useTranslation()
  const [openSection, setOpenSection] = useState<string | null>('identity')
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [internalNotes, setInternalNotes] = useState(athlete.internalNotes ?? '')

  const toggleSection = (name: string) => setOpenSection(openSection === name ? null : name)
  const toggleEdit = (section: string) => setEditingSection(editingSection === section ? null : section)

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
    { key: 'eapCity', label: t('athlete.eapCity'), type: 'select', options: [
      { value: '', label: '—' },
      ...eapCities.map(c => ({ value: c.id, label: c.name })),
    ]},
  ]

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
    { key: 'estAppearance', label: t('collaborator.estAppearance'), type: 'number' },
    { key: 'estTravel', label: t('collaborator.estTravel'), type: 'number' },
    { key: 'estAccommodation', label: t('collaborator.estAccommodation'), type: 'number' },
    { key: 'estTotal', label: t('selection.estimatedCost'), type: 'number' },
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
          onSave={(data) => {
            mutations.athleteUpdate.mutate(data, { onSuccess: () => setEditingSection(null) })
          }}
          isPending={mutations.athleteUpdate.isPending}
          error={mutations.athleteUpdate.error}
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
        {renderSection('compliance', t('compliance.title'), complianceFields, true)}
        {renderSection('logistics', t('logistics.title'), logisticsFields, true)}
      </div>

      <div className="space-y-4">
        {isStaff && (
          <CollapsibleSection title={t('selection.assignedSelector')} isOpen={openSection === 'selector'} onToggle={() => toggleSection('selector')}>
            <SelectorAssign
              currentValue={athlete.assignedSelector}
              staffUsers={staffUsers}
              onSave={(val) => mutations.athleteUpdate.mutate({ assignedSelector: val || null })}
              isPending={mutations.athleteUpdate.isPending}
              t={t}
            />
          </CollapsibleSection>
        )}
        {isStaff && renderSection('costs', t('selection.estimatedCost'), costFields, false)}
        {isStaff && renderSection('payment', t('collaborator.payment'), paymentFields, true)}

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
                  onClick={() => mutations.internalNotes.mutate(internalNotes)}
                  disabled={mutations.internalNotes.isPending}
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
}

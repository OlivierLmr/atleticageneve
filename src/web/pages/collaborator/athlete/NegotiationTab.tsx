import { useTranslation } from 'react-i18next'
import { inputCls } from '@web/lib/ui-constants'
import type { AthleteDetail, Interaction } from '@shared/types'
import { AgreementCard, CounterOfferCard, InteractionCard } from './components'

type TimelineItem =
  | { kind: 'agreement'; id: string; date: string; data: AthleteDetail['agreements'][number] }
  | { kind: 'counter_offer'; id: string; date: string; data: Interaction }

export function NegotiationTab({ athlete, isStaff, isAthleteOrManager, canSendAgreement, onShowAgreementForm, noteType, onNoteTypeChange, noteContent, onNoteContentChange, onAddNote, isNotePending, onViewEmail }: {
  athlete: AthleteDetail
  isStaff: boolean
  isAthleteOrManager: boolean
  canSendAgreement: boolean
  onShowAgreementForm: () => void
  noteType: 'note' | 'call' | 'email'
  onNoteTypeChange: (type: 'note' | 'call' | 'email') => void
  noteContent: string
  onNoteContentChange: (content: string) => void
  onAddNote: () => void
  isNotePending: boolean
  onViewEmail: (emailLogId: string) => void
}) {
  const { t, i18n } = useTranslation()

  const currentStatus = athlete.negotiationStatus
  const latestAgreement = athlete.agreements.length
    ? athlete.agreements[athlete.agreements.length - 1]
    : undefined

  const selectedEventNames = athlete.applications
    .filter(a => a.participationStatus === 'selected')
    .map(a => `${a.event.catalog.name} ${a.event.catalog.gender === 'M' ? (i18n.language === 'fr' ? 'Hommes' : 'Men') : (i18n.language === 'fr' ? 'Femmes' : 'Women')}`)
  const meetingName = athlete.edition?.name ?? 'Atletica Geneve'

  const agreementItems: TimelineItem[] = athlete.agreements.map(a => ({
    kind: 'agreement' as const,
    id: a.id,
    date: a.sentAt,
    data: a,
  }))

  const counterOfferItems: TimelineItem[] = athlete.interactions
    .filter(i => i.type === 'counter_offer')
    .map(i => ({
      kind: 'counter_offer' as const,
      id: i.id,
      date: i.createdAt,
      data: i,
    }))

  const toMs = (d: string) =>
    new Date(d.includes('T') ? d : d.replace(' ', 'T') + 'Z').getTime()
  const timelineItems = [...agreementItems, ...counterOfferItems]
    .sort((a, b) => toMs(b.date) - toMs(a.date))

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left: Agreements */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">{t('contract.title')}</h3>
            {isStaff && (currentStatus === 'to_review' || currentStatus === 'counter_offer_sent') && (
              <button
                onClick={onShowAgreementForm}
                disabled={!canSendAgreement}
                title={!canSendAgreement ? t('selection.decideAllFirst') : undefined}
                className={`text-xs ${canSendAgreement ? 'text-blue-600 hover:text-blue-800' : 'text-gray-300 cursor-not-allowed'}`}
              >
                {latestAgreement ? t('contract.newVersion') : t('action.sendAgreement')}
              </button>
            )}
          </div>

          {currentStatus === 'confirmed' && timelineItems.length === 0 ? (
            <p className="text-sm text-green-700 italic">{t('selection.acceptedAtMeeting')}</p>
          ) : timelineItems.length === 0 ? (
            <p className="text-xs text-gray-400">{t('contract.noOfferYet')}</p>
          ) : (
            <div className="space-y-3">
              {timelineItems.map(item =>
                item.kind === 'agreement'
                  ? (
                    <AgreementCard
                      key={item.id}
                      agreement={item.data}
                      selectedEventNames={selectedEventNames}
                      meetingName={meetingName}
                      lang={i18n.language}
                      isStaff={!!isStaff}
                      t={t}
                    />
                  )
                  : <CounterOfferCard key={item.id} interaction={item.data} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Timeline */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-sm mb-3">{t('collaborator.addNote')}</h3>
          {isStaff && (
            <select
              className={`${inputCls} mb-2`}
              value={noteType}
              onChange={e => onNoteTypeChange(e.target.value as 'note' | 'call' | 'email')}
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
            onChange={e => onNoteContentChange(e.target.value)}
          />
          <button
            onClick={onAddNote}
            disabled={isNotePending || !noteContent.trim()}
            className="mt-2 text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {t('common.add')}
          </button>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <h3 className="font-semibold text-sm mb-3">{t('collaborator.timeline')}</h3>
          {athlete.interactions.length === 0 ? (
            <p className="text-xs text-gray-400">{t('collaborator.noInteractions')}</p>
          ) : (
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {athlete.interactions.map(interaction => (
                <InteractionCard key={interaction.id} interaction={interaction} onViewEmail={onViewEmail} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

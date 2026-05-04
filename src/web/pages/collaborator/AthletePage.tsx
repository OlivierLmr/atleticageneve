import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { NEGOTIATION_TRANSITIONS, COMMITTEE_EXTRA_TRANSITIONS, ATHLETE_TRANSITIONS } from '@shared/constants'
import { STATUS_COLORS } from '@web/lib/ui-constants'
import type { NegotiationStatus } from '@shared/types'
import { defaultAgreement } from './athlete/types'
import type { AgreementFormDraft } from './athlete/types'
import { useAthleteData, useAthleteMutations, useEmailQuery } from './athlete/useAthleteData'
import { BannerEventRow, CostPopup } from './athlete/BannerEventRow'
import { PersonalTab } from './athlete/PersonalTab'
import { NegotiationTab } from './athlete/NegotiationTab'
import {
  ConfirmTransitionDialog,
  EmailPreviewModal,
  EmailPopupModal,
  CounterOfferModal,
  MessageModal,
  AgreementFormModal,
} from './athlete/modals'

export default function AthletePage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // ── Data ───────────────────────────────���──────────────────────────────
  const { athlete, isLoading, staffUsers, allRooms } = useAthleteData(id)
  const mutations = useAthleteMutations(id)

  // ── UI state ───────────────��──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'personal' | 'negotiation'>('negotiation')
  const [confirmDialog, setConfirmDialog] = useState<{
    fromStatus: NegotiationStatus
    toStatus: NegotiationStatus
    onConfirm: () => void
  } | null>(null)
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null)
  const [showAgreementForm, setShowAgreementForm] = useState(false)
  const [noteType, setNoteType] = useState<'note' | 'call' | 'email'>('note')
  const [noteContent, setNoteContent] = useState('')
  const [agreementForm, setAgreementForm] = useState<AgreementFormDraft>(() => defaultAgreement())
  const [showCostPopup, setShowCostPopup] = useState(false)
  const [showCounterOfferModal, setShowCounterOfferModal] = useState(false)
  const [counterOfferText, setCounterOfferText] = useState('')
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [viewingEmailId, setViewingEmailId] = useState<string | null>(null)
  const [agreementInitialized, setAgreementInitialized] = useState(false)

  const { data: viewingEmail } = useEmailQuery(viewingEmailId)

  // Initialize agreement form from latest agreement once
  const latestAgreement = athlete?.agreements?.length
    ? athlete.agreements[athlete.agreements.length - 1]
    : undefined

  if (athlete && !agreementInitialized) {
    if (latestAgreement) {
      setAgreementForm(defaultAgreement(latestAgreement))
    }
    setAgreementInitialized(true)
  }

  // Propagate email preview from mutations
  const handleStatusSuccess = (data: { emailPreview?: { subject: string; body: string } } | undefined) => {
    setConfirmDialog(null)
    if (data?.emailPreview) setEmailPreview(data.emailPreview)
  }

  // ── Loading ─────────────────��─────────────────────────────────────────
  if (isLoading || !athlete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  // ── Derived state ─────���──────────────────────��────────────────────────
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
  const hasAtLeastOneSelected = athlete.applications.some(a => a.participationStatus === 'selected')
  const canSendAgreement = allDecided && hasAtLeastOneSelected

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
      {/* ── Banner ────��─────────────────────────────────────────────────── */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {/* Top row: navigation + language */}
          <div className="flex items-center justify-between mb-3">
            {(isCommittee || user?.role === 'collaborator') ? (
              <button
                onClick={() => navigate(-1)}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ← {t('common.back')}
              </button>
            ) : user?.role === 'manager' ? (
              <Link
                to="/manager/portal"
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                ← {t('common.back')}
              </Link>
            ) : (
              <button
                onClick={() => logout()}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                {t('auth.logout')}
              </button>
            )}
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
                  <>
                    <a href={athlete.waProfileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800" title="World Athletics">
                      WA ↗
                    </a>
                    {isStaff && (
                      <button
                        onClick={() => mutations.waFetchMutation.mutate()}
                        disabled={mutations.waFetchMutation.isPending}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title={t('wa.fetch')}
                      >
                        {mutations.waFetchMutation.isPending ? t('wa.fetching') : '↻ WA'}
                      </button>
                    )}
                  </>
                )}
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
              {isStaff && (currentStatus === 'to_review' || currentStatus === 'counter_offer_sent') && (
                <button
                  onClick={() => { setActiveTab('negotiation'); setShowAgreementForm(true) }}
                  disabled={!canSendAgreement}
                  title={!canSendAgreement ? t('selection.decideAllFirst') : undefined}
                  className={`text-xs px-3 py-1.5 rounded font-medium border ${
                    canSendAgreement
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed'
                  }`}
                >
                  {t('action.sendAgreement')}
                </button>
              )}

              {isStaff && currentStatus === 'agreement_sent' && (
                <span className="text-xs text-gray-500 italic py-1.5">{t('action.awaitingResponse')}</span>
              )}

              {allowedTransitions.map((toStatus) => {
                const committeeOnly = isCommitteeOnly(toStatus as NegotiationStatus)
                const buttonLabel = isAthleteOrManager
                  ? toStatus === 'confirmed' ? t('action.accept')
                    : toStatus === 'counter_offer_sent' ? t('action.sendCounterOffer')
                    : toStatus === 'withdrawn' ? t('action.withdraw')
                    : t(`status.${toStatus}`)
                  : committeeOnly && toStatus === 'rejected' ? t('action.overrideReject')
                  : toStatus === 'to_review' ? t('action.reopen')
                  : toStatus === 'rejected' ? t('action.reject')
                  : t(`status.${toStatus}`)

                return (
                  <button
                    key={toStatus}
                    onClick={() => {
                      if (isAthleteOrManager && toStatus === 'counter_offer_sent') {
                        setShowCounterOfferModal(true)
                      } else {
                        setConfirmDialog({
                          fromStatus: currentStatus,
                          toStatus: toStatus as NegotiationStatus,
                          onConfirm: () => mutations.statusMutation.mutate(toStatus as NegotiationStatus, {
                            onSuccess: handleStatusSuccess,
                          }),
                        })
                      }
                    }}
                    disabled={mutations.statusMutation.isPending}
                    className={`text-xs px-3 py-1.5 rounded font-medium border ${
                      toStatus === 'confirmed'
                        ? 'bg-green-600 text-white border-green-600 hover:bg-green-700'
                        : toStatus === 'rejected' && committeeOnly
                        ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                        : toStatus === 'rejected'
                        ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                        : toStatus === 'withdrawn'
                        ? 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                        : toStatus === 'counter_offer_sent'
                        ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
                        : toStatus === 'to_review' && committeeOnly
                        ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100'
                        : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    {buttonLabel}
                  </button>
                )
              })}

              <button
                onClick={() => setShowMessageModal(true)}
                className="text-xs px-3 py-1.5 rounded font-medium border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              >
                {t('action.sendMessage')}
              </button>

              {allowedTransitions.length === 0 && !isAthleteOrManager && !(isStaff && currentStatus === 'agreement_sent') && (
                <span className="text-xs text-gray-400 py-1.5">{t('selection.noActions')}</span>
              )}
            </div>
          </div>

          {mutations.statusMutation.isError && (
            <p className="text-xs text-red-600 mt-2">{(mutations.statusMutation.error as Error)?.message || t('common.error')}</p>
          )}

          {showCounterOfferModal && (
            <CounterOfferModal
              text={counterOfferText}
              onTextChange={setCounterOfferText}
              onSubmit={() => {
                if (counterOfferText.trim()) {
                  mutations.counterOfferMutation.mutate(counterOfferText, {
                    onSuccess: (data) => {
                      setShowCounterOfferModal(false)
                      setCounterOfferText('')
                      if (data?.emailPreview) setEmailPreview(data.emailPreview)
                    },
                  })
                }
              }}
              onCancel={() => { setShowCounterOfferModal(false); setCounterOfferText('') }}
              isPending={mutations.counterOfferMutation.isPending}
              error={mutations.counterOfferMutation.error}
            />
          )}

          {showMessageModal && (
            <MessageModal
              text={messageText}
              onTextChange={setMessageText}
              onSubmit={() => {
                if (messageText.trim()) {
                  mutations.freeMessageMutation.mutate(messageText, {
                    onSuccess: () => { setShowMessageModal(false); setMessageText('') },
                  })
                }
              }}
              onCancel={() => { setShowMessageModal(false); setMessageText('') }}
              isPending={mutations.freeMessageMutation.isPending}
              error={mutations.freeMessageMutation.error}
            />
          )}

          {/* Events in banner */}
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
                    mutations.participationMutation.mutate({ appId, status })
                  }
                  onRescore={(appId) => mutations.scoreMutation.mutate(appId)}
                  onWaPerfSave={(athleteId, eventId, data) =>
                    mutations.waPerfMutation.mutate({ athleteId, eventId, ...data })
                  }
                  isPendingParticipation={mutations.participationMutation.isPending}
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

      {/* ── Tab content ────────────��─────────────────────────���───────────── */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'personal' && (
          <PersonalTab
            athlete={athlete}
            isStaff={!!isStaff}
            isAthleteOrManager={isAthleteOrManager}
            staffUsers={staffUsers}
            mutations={{
              athleteUpdate: mutations.athleteUpdateMutation,
              internalNotes: mutations.internalNotesMutation,
            }}
          />
        )}

        {activeTab === 'negotiation' && (
          <NegotiationTab
            athlete={athlete}
            isStaff={!!isStaff}
            isAthleteOrManager={isAthleteOrManager}
            canSendAgreement={canSendAgreement}
            onShowAgreementForm={() => setShowAgreementForm(true)}
            noteType={noteType}
            onNoteTypeChange={setNoteType}
            noteContent={noteContent}
            onNoteContentChange={setNoteContent}
            onAddNote={() => {
              if (noteContent.trim()) {
                mutations.noteMutation.mutate(
                  { type: isAthleteOrManager ? 'note' : noteType, content: noteContent },
                  { onSuccess: () => setNoteContent('') },
                )
              }
            }}
            isNotePending={mutations.noteMutation.isPending}
            onViewEmail={setViewingEmailId}
          />
        )}

        {/* Archive button — committee only */}
        {isCommittee && !athlete.archivedAt && (
          <div className="mt-6 text-right">
            <button
              onClick={() => {
                if (confirm(t('confirm.archiveAthlete', { athlete: `${athlete.firstName} ${athlete.lastName}` }))) {
                  mutations.archiveMutation.mutate()
                }
              }}
              disabled={mutations.archiveMutation.isPending}
              className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-3 py-1.5 hover:bg-red-50 disabled:opacity-50"
            >
              {t('collaborator.archiveAthlete')}
            </button>
            {mutations.archiveMutation.isError && (
              <p className="text-xs text-red-600 mt-1">{(mutations.archiveMutation.error as Error)?.message || t('common.error')}</p>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ────────���──────────────────────────────────────────────── */}
      {confirmDialog && (
        <ConfirmTransitionDialog
          fromStatus={confirmDialog.fromStatus}
          toStatus={confirmDialog.toStatus}
          athlete={athlete}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          isPending={mutations.statusMutation.isPending || mutations.agreementMutation.isPending}
        />
      )}

      {emailPreview && (
        <EmailPreviewModal emailPreview={emailPreview} onClose={() => setEmailPreview(null)} />
      )}

      {viewingEmailId && (
        <EmailPopupModal email={viewingEmail} onClose={() => setViewingEmailId(null)} />
      )}

      {showAgreementForm && isStaff && (
        <AgreementFormModal
          form={agreementForm}
          onChange={setAgreementForm}
          allRooms={allRooms}
          athlete={athlete}
          onSubmit={() => mutations.agreementMutation.mutate(agreementForm, {
            onSuccess: (data) => {
              setShowAgreementForm(false)
              if (data?.emailPreview) setEmailPreview(data.emailPreview)
            },
          })}
          onClose={() => setShowAgreementForm(false)}
          isPending={mutations.agreementMutation.isPending}
          error={mutations.agreementMutation.error}
        />
      )}
    </div>
  )
}

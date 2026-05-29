import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NIGHT_LABELS, DINNER_LABELS } from '@shared/constants'
import { inputCls, labelCls } from '@web/lib/ui-constants'
import type { NegotiationStatus, AthleteDetail, Agreement } from '@shared/types'
import type { AgreementFormDraft, HotelWithRooms } from './types'

// ── Confirm transition dialog ───────────────────────────────────────────────

export function ConfirmTransitionDialog({ fromStatus, toStatus, athlete, onConfirm, onCancel, isPending }: {
  fromStatus: NegotiationStatus
  toStatus: NegotiationStatus
  athlete: AthleteDetail
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onCancel}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-gray-900 mb-5 leading-relaxed">
          {t(`confirm.transition.${fromStatus}__${toStatus}`, {
            athlete: `${athlete.firstName} ${athlete.lastName}`,
            meeting: athlete.edition?.name ?? '',
          })}
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className={`text-xs px-3 py-1.5 rounded font-medium text-white disabled:opacity-50 ${
              toStatus === 'rejected'
                ? 'bg-red-600 hover:bg-red-700'
                : toStatus === 'to_review'
                ? 'bg-orange-600 hover:bg-orange-700'
                : toStatus === 'confirmed'
                ? 'bg-green-600 hover:bg-green-700'
                : toStatus === 'withdrawn'
                ? 'bg-gray-600 hover:bg-gray-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Email preview modal ─────────────────────────────────────────────────────

export function EmailPreviewModal({ emailPreview, onClose }: {
  emailPreview: { subject: string; body: string; htmlBody?: string }
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">{t('emailPreview.title')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 text-sm space-y-3">
          <p className="text-xs text-gray-500">{t('emailPreview.description')}</p>
          <div className="text-xs text-gray-700">
            <span className="font-medium">{t('emailPreview.subject')}:</span> {emailPreview.subject}
          </div>
          {emailPreview.htmlBody ? (
            <div className="text-sm prose prose-sm max-w-none bg-gray-50 p-3 rounded border" dangerouslySetInnerHTML={{ __html: emailPreview.htmlBody }} />
          ) : (
            <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded border">{emailPreview.body}</pre>
          )}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="text-xs px-4 py-1.5 rounded font-medium bg-gray-900 text-white hover:bg-gray-800"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Email popup (viewing sent email) ────────────────────────────────────────

export function EmailPopupModal({ email, onClose }: {
  email: { subject: string; body: string; htmlBody?: string; to: string; sentAt: string } | undefined
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">{t('collaborator.emailDetail')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {email ? (
          <div className="p-4 text-sm space-y-2">
            <div className="text-xs text-gray-500">
              <span className="font-medium">{t('admin.emailTo')}:</span> {email.to}
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-medium">{t('admin.subject')}:</span> {email.subject}
            </div>
            <div className="text-xs text-gray-400">
              {new Date(email.sentAt).toLocaleString()}
            </div>
            <div className="border-t pt-3 mt-2">
              {email.htmlBody ? (
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: email.htmlBody }} />
              ) : (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap">{email.body}</pre>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-gray-400">{t('common.loading')}</div>
        )}
      </div>
    </div>
  )
}

// ── Counter-offer modal ─────────────────────────────────────────────────────

export function CounterOfferModal({ text, onTextChange, onSubmit, onCancel, isPending, error }: {
  text: string
  onTextChange: (text: string) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  error: Error | null
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 p-4 rounded border border-purple-300 bg-purple-50">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('action.counterOffer')}</h3>
      <textarea
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
        rows={4}
        placeholder={t('action.counterOfferPlaceholder')}
        value={text}
        onChange={e => onTextChange(e.target.value)}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !text.trim()}
          className="text-xs px-3 py-1.5 rounded font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {isPending ? t('common.loading') : t('common.submit')}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error.message || t('common.error')}</p>
      )}
    </div>
  )
}

// ── Free message modal ──────────────────────────────────────────────────────

export function MessageModal({ text, onTextChange, onSubmit, onCancel, isPending, error }: {
  text: string
  onTextChange: (text: string) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
  error: Error | null
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 p-4 rounded border border-gray-300 bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">{t('action.sendMessage')}</h3>
      <textarea
        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
        rows={3}
        placeholder={t('action.messagePlaceholder')}
        value={text}
        onChange={e => onTextChange(e.target.value)}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={onSubmit}
          disabled={isPending || !text.trim()}
          className="text-xs px-3 py-1.5 rounded font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {isPending ? t('common.loading') : t('common.submit')}
        </button>
        <button
          onClick={onCancel}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50"
        >
          {t('common.cancel')}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error.message || t('common.error')}</p>
      )}
    </div>
  )
}

// ── Agreement form modal ────────────────────────────────────────────────────

export function AgreementFormModal({ form, onChange, allRooms, athlete, onSubmit, onClose, isPending, error }: {
  form: AgreementFormDraft
  onChange: (updater: (prev: AgreementFormDraft) => AgreementFormDraft) => void
  allRooms: { id: string; hotelId: string; hotelName: string; roomType: string; costPerNight: number; dinnerCost: number; negotiatingCount: number; confirmedCount: number; reservedRooms: number }[]
  athlete: AthleteDetail
  onSubmit: () => void
  onClose: () => void
  isPending: boolean
  error: Error | null
}) {
  const { t } = useTranslation()

  const [selectedHotelId, setSelectedHotelId] = useState<string>(() =>
    allRooms.find(r => r.id === form.hotelRoomId)?.hotelId ?? ''
  )

  // Derive unique hotel list from allRooms
  const hotels = Array.from(
    new Map(allRooms.map(r => [r.hotelId, { id: r.hotelId, name: r.hotelName }])).values()
  )
  const roomsForHotel = allRooms.filter(r => r.hotelId === selectedHotelId)
  const selectedRoom = allRooms.find(r => r.id === form.hotelRoomId)

  const handleHotelChange = (hotelId: string) => {
    setSelectedHotelId(hotelId)
    // Clear room selection if it belongs to a different hotel
    if (form.hotelRoomId && allRooms.find(r => r.id === form.hotelRoomId)?.hotelId !== hotelId) {
      onChange(p => ({ ...p, hotelRoomId: '' }))
    }
  }

  const hasRoom = !!form.hotelRoomId

  const room = selectedRoom
  const nights = NIGHT_LABELS.filter(n => form[`hotelNight${n.charAt(0).toUpperCase() + n.slice(1)}` as keyof AgreementFormDraft]).length
  const dinners = DINNER_LABELS.filter(d => form[`dinner${d.charAt(0).toUpperCase() + d.slice(1)}` as keyof AgreementFormDraft]).length
  let total = (form.appearanceFee || 0) + (form.otherCompensation || 0) + (form.transport || 0)
  total += nights * (room?.costPerNight ?? 0)
  total += dinners * (room?.dinnerCost ?? 0)
  if (form.stadiumMeals) total += athlete.edition?.stadiumMealCost ?? 0
  if (form.transportAirportHotel) total += athlete.edition?.transportAirportHotelCost ?? 0
  if (form.transportHotelStadium) total += athlete.edition?.transportHotelStadiumCost ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">
            {t('contract.sendOffer')} — v{(athlete.agreements.length || 0) + 1}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className={labelCls}>{t('contract.bonus')} (CHF)</label>
            <input
              type="number"
              className={`${inputCls} text-right`}
              value={form.appearanceFee}
              placeholder="0"
              onChange={e => onChange(p => ({ ...p, appearanceFee: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('contract.otherCompensation')} (CHF)</label>
              <input
                type="number"
                className={`${inputCls} text-right`}
                value={form.otherCompensation}
                placeholder="0"
                onChange={e => onChange(p => ({ ...p, otherCompensation: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
              />
            </div>
            <div>
              <label className={labelCls}>{t('contract.description')}</label>
              <input
                className={inputCls}
                value={form.otherCompensationDesc}
                onChange={e => onChange(p => ({ ...p, otherCompensationDesc: e.target.value }))}
                placeholder={t('contract.otherCompensationDesc')}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('contract.transport')} (CHF)</label>
            <input
              type="number"
              className={`${inputCls} text-right`}
              value={form.transport}
              placeholder="0"
              onChange={e => onChange(p => ({ ...p, transport: e.target.value === '' ? '' : (parseInt(e.target.value) || 0) }))}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.transportAirportHotel}
                onChange={e => onChange(p => ({ ...p, transportAirportHotel: e.target.checked }))} />
              {t('contract.transportAirportHotel')}
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.transportHotelStadium}
                onChange={e => onChange(p => ({ ...p, transportHotelStadium: e.target.checked }))} />
              {t('contract.transportHotelStadium')}
            </label>
          </div>

          {/* Hotel selection — step 1 */}
          <div>
            <label className={labelCls}>{t('logistics.hotel')}</label>
            <select className={inputCls} value={selectedHotelId}
              onChange={e => handleHotelChange(e.target.value)}>
              <option value="">— {t('contract.noHotelRoom')} —</option>
              {hotels.map(h => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>

          {/* Room type selection — step 2, requires hotel */}
          <div>
            <label className={labelCls}>{t('contract.roomType')}</label>
            <select
              className={`${inputCls} ${!selectedHotelId ? 'opacity-50 cursor-not-allowed' : ''}`}
              value={form.hotelRoomId}
              disabled={!selectedHotelId}
              onChange={e => onChange(p => ({ ...p, hotelRoomId: e.target.value }))}
            >
              <option value="">
                {selectedHotelId ? `— ${t('contract.noHotelRoom')} —` : t('contract.selectHotelFirst')}
              </option>
              {roomsForHotel.map(r => (
                <option key={r.id} value={r.id}>
                  {r.roomType} (CHF {r.costPerNight}/nuit)
                </option>
              ))}
            </select>
            {selectedRoom && (
              <p className="text-xs text-gray-500 mt-1">
                {t('contract.roomAvailability', {
                  negotiating: selectedRoom.negotiatingCount,
                  confirmed: selectedRoom.confirmedCount,
                  total: selectedRoom.reservedRooms,
                })}
              </p>
            )}
          </div>

          {/* Hotel nights — requires room selection */}
          <div>
            <label className={`${labelCls} ${!hasRoom ? 'text-gray-400' : ''}`}>{t('contract.hotelNights')}</label>
            <div className="flex gap-2">
              {NIGHT_LABELS.map(night => {
                const key = `hotelNight${night.charAt(0).toUpperCase() + night.slice(1)}` as keyof AgreementFormDraft
                return (
                  <label key={night} className={`flex flex-col items-center text-xs px-2 py-1 rounded border ${
                    !hasRoom
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : form[key]
                        ? 'bg-gray-900 text-white border-gray-900 cursor-pointer'
                        : 'border-gray-300 cursor-pointer'
                  }`}>
                    <input type="checkbox" className="sr-only" checked={form[key] as boolean}
                      disabled={!hasRoom}
                      onChange={e => onChange(p => ({ ...p, [key]: e.target.checked }))} />
                    {t(`night.${night}`)}
                  </label>
                )
              })}
            </div>
            {!hasRoom && (
              <p className="text-xs text-gray-400 mt-1">{t('contract.nightsDinnersRequireRoom')}</p>
            )}
          </div>

          {/* Dinners — requires room selection */}
          <div>
            <label className={`${labelCls} ${!hasRoom ? 'text-gray-400' : ''}`}>{t('contract.dinners')}</label>
            <div className="flex gap-2">
              {DINNER_LABELS.map(day => {
                const key = `dinner${day.charAt(0).toUpperCase() + day.slice(1)}` as keyof AgreementFormDraft
                return (
                  <label key={day} className={`flex flex-col items-center text-xs px-2 py-1 rounded border ${
                    !hasRoom
                      ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                      : form[key]
                        ? 'bg-gray-900 text-white border-gray-900 cursor-pointer'
                        : 'border-gray-300 cursor-pointer'
                  }`}>
                    <input type="checkbox" className="sr-only" checked={form[key] as boolean}
                      disabled={!hasRoom}
                      onChange={e => onChange(p => ({ ...p, [key]: e.target.checked }))} />
                    {t(`night.${day}`)}
                  </label>
                )
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.stadiumMeals}
              onChange={e => onChange(p => ({ ...p, stadiumMeals: e.target.checked }))} />
            {t('contract.stadiumMeals')}
          </label>
          <div>
            <label className={labelCls}>{t('contract.notesToAthlete')}</label>
            <textarea className={inputCls} rows={2} value={form.notes}
              onChange={e => onChange(p => ({ ...p, notes: e.target.value }))} />
          </div>

          {/* Live cost preview */}
          <div className="bg-gray-50 rounded p-3 text-sm">
            <div className="flex justify-between font-semibold">
              <span>{t('contract.totalCost')}</span>
              <span>CHF {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border rounded hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={onSubmit}
              disabled={isPending}
              className="px-6 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {isPending ? t('common.loading') : t('contract.validate')}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-600">{error.message || t('common.error')}</p>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@web/lib/api'
import { EmailPreviewModal } from '@web/pages/collaborator/athlete/modals'
import type { PaymentEntry } from '@shared/types'

export default function PaymentsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: payments = [], isLoading } = useQuery<PaymentEntry[]>({
    queryKey: ['payments'],
    queryFn: () => api.get('/api/v1/payments'),
  })

  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string; htmlBody?: string } | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const sendEmailMutation = useMutation({
    mutationFn: (athleteId: string) =>
      api.post<{ emailPreview: { subject: string; body: string; htmlBody: string } }>(
        `/api/v1/payments/${athleteId}/send-email`
      ),
    onSuccess: (data) => {
      setEmailPreview(data.emailPreview)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  const togglePaymentMutation = useMutation({
    mutationFn: ({ athleteId, status }: { athleteId: string; status: 'pending' | 'done' }) =>
      api.patch(`/api/v1/athletes/${athleteId}`, {
        paymentStatus: status,
        ...(status === 'done' ? { paymentDate: new Date().toISOString().split('T')[0] } : { paymentDate: null }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 text-gray-400 text-sm">{t('common.loading')}</div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-2">{t('payments.title')}</h1>
        <p className="text-gray-400 text-sm">{t('payments.noPayments')}</p>
      </div>
    )
  }

  const currency = payments[0]?.currency ?? 'CHF'
  const pendingTotal = payments
    .filter(p => p.paymentStatus === 'pending')
    .reduce((sum, p) => sum + p.totalDue, 0)
  const doneTotal = payments
    .filter(p => p.paymentStatus === 'done')
    .reduce((sum, p) => sum + p.totalDue, 0)

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">{t('payments.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('payments.subtitle')}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <p className="text-xs text-amber-600 font-medium">{t('common.pending')}</p>
            <p className="text-lg font-bold text-amber-700">{currency} {pendingTotal.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-600 font-medium">{t('common.done')}</p>
            <p className="text-lg font-bold text-green-700">{currency} {doneTotal.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.athlete')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.recipient')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.events')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('payments.appearanceFee')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('payments.prizeMoney')}</th>
              <th className="px-3 py-2.5 text-right font-medium">{t('payments.otherCompensation')}</th>
              <th className="px-3 py-2.5 text-right font-medium font-semibold">{t('payments.totalDue')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.iban')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.status')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.athleteId} className={`border-b hover:bg-gray-50 ${p.paymentStatus === 'done' ? 'opacity-60' : ''}`}>
                {/* Athlete */}
                <td className="px-3 py-2.5">
                  <Link
                    to={`/committee/athletes/${p.athleteId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {p.athleteLastName}, {p.athleteFirstName}
                  </Link>
                </td>

                {/* Recipient */}
                <td className="px-3 py-2.5 text-xs text-gray-600">
                  <div className="font-medium">{p.recipientName}</div>
                  {p.managerId && (
                    <div className="text-gray-400">{t('manager.portal')}</div>
                  )}
                  {p.recipientEmail && (
                    <div className="text-gray-400 truncate max-w-[140px]">{p.recipientEmail}</div>
                  )}
                </td>

                {/* Events with placement */}
                <td className="px-3 py-2.5 text-xs">
                  <div className="space-y-0.5">
                    {p.events.map(e => (
                      <div key={e.applicationId} className="flex items-center gap-1">
                        <span className="text-gray-700">{e.eventName}</span>
                        {e.finalPlacement != null ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            #{e.finalPlacement}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">({t('payments.noPlacement')})</span>
                        )}
                      </div>
                    ))}
                  </div>
                </td>

                {/* Appearance fee */}
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {p.appearanceFee > 0 ? `${currency} ${p.appearanceFee.toLocaleString()}` : '—'}
                </td>

                {/* Prize money */}
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {p.totalPrizeMoney > 0 ? `${currency} ${p.totalPrizeMoney.toLocaleString()}` : '—'}
                </td>

                {/* Other compensation */}
                <td className="px-3 py-2.5 text-right font-mono text-xs">
                  {p.otherCompensation > 0 ? (
                    <span title={p.otherCompensationDesc ?? undefined}>
                      {currency} {p.otherCompensation.toLocaleString()}
                    </span>
                  ) : '—'}
                </td>

                {/* Total */}
                <td className="px-3 py-2.5 text-right font-mono font-semibold text-sm">
                  {currency} {p.totalDue.toLocaleString()}
                </td>

                {/* IBAN */}
                <td className="px-3 py-2.5 text-xs">
                  {p.recipientIban ? (
                    <span className="text-green-700 font-mono text-[11px]">{p.recipientIban}</span>
                  ) : (
                    <span className="text-amber-600 font-medium">{t('payments.ibanMissing')}</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    p.paymentStatus === 'done'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {t(`common.${p.paymentStatus}`)}
                  </span>
                  {p.paymentDate && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{p.paymentDate}</div>
                  )}
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={async () => {
                        setSendingId(p.athleteId)
                        try {
                          await sendEmailMutation.mutateAsync(p.athleteId)
                        } finally {
                          setSendingId(null)
                        }
                      }}
                      disabled={sendingId === p.athleteId}
                      className="text-[10px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      {sendingId === p.athleteId ? t('payments.sending') : t('payments.sendProforma')}
                    </button>
                    <button
                      onClick={async () => {
                        setTogglingId(p.athleteId)
                        try {
                          await togglePaymentMutation.mutateAsync({
                            athleteId: p.athleteId,
                            status: p.paymentStatus === 'done' ? 'pending' : 'done',
                          })
                        } finally {
                          setTogglingId(null)
                        }
                      }}
                      disabled={togglingId === p.athleteId}
                      className={`text-[10px] px-2 py-1 rounded border whitespace-nowrap disabled:opacity-50 ${
                        p.paymentStatus === 'done'
                          ? 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          : 'border-green-200 text-green-700 hover:bg-green-50'
                      }`}
                    >
                      {p.paymentStatus === 'done' ? t('payments.markPending') : t('payments.markPaid')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {emailPreview && (
        <EmailPreviewModal emailPreview={emailPreview} onClose={() => setEmailPreview(null)} />
      )}
    </div>
  )
}

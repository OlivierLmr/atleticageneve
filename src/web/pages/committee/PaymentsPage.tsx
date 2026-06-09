import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@web/lib/api'
import { EmailPreviewModal } from '@web/pages/collaborator/athlete/modals'
import type { PaymentEntry } from '@shared/types'

type SortColumn = 'athlete' | 'recipient' | 'appearanceFee' | 'prizeMoney' | 'otherCompensation' | 'total' | 'iban' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  column: SortColumn
  direction: SortDirection
}

interface FilterConfig {
  athlete: string
  recipient: string
  event: string
  iban: 'all' | 'present' | 'missing'
  status: 'all' | 'pending' | 'done'
}

const DEFAULT_FILTERS: FilterConfig = { athlete: '', recipient: '', event: '', iban: 'all', status: 'all' }

function SortIcon({ column, sortConfig }: { column: SortColumn; sortConfig: SortConfig | null }) {
  if (!sortConfig || sortConfig.column !== column) {
    return <span className="ml-1 text-gray-300">↕</span>
  }
  return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
}

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
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS)

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

  const allEventNames = useMemo(() => {
    const names = new Set<string>()
    payments.forEach(p => p.events.forEach(e => names.add(e.eventName)))
    return Array.from(names).sort()
  }, [payments])

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const athleteName = `${p.athleteLastName} ${p.athleteFirstName}`.toLowerCase()
      if (filters.athlete && !athleteName.includes(filters.athlete.toLowerCase())) return false
      if (filters.recipient && !p.recipientName.toLowerCase().includes(filters.recipient.toLowerCase())) return false
      if (filters.event && !p.events.some(e => e.eventName === filters.event)) return false
      if (filters.iban === 'present' && !p.recipientIban) return false
      if (filters.iban === 'missing' && p.recipientIban) return false
      if (filters.status !== 'all' && p.paymentStatus !== filters.status) return false
      return true
    })
  }, [payments, filters])

  const sortedPayments = useMemo(() => {
    if (!sortConfig) return filteredPayments
    return [...filteredPayments].sort((a, b) => {
      let cmp = 0
      switch (sortConfig.column) {
        case 'athlete':
          cmp = `${a.athleteLastName} ${a.athleteFirstName}`.localeCompare(`${b.athleteLastName} ${b.athleteFirstName}`)
          break
        case 'recipient':
          cmp = a.recipientName.localeCompare(b.recipientName)
          break
        case 'appearanceFee':
          cmp = a.appearanceFee - b.appearanceFee
          break
        case 'prizeMoney':
          cmp = a.totalPrizeMoney - b.totalPrizeMoney
          break
        case 'otherCompensation':
          cmp = a.otherCompensation - b.otherCompensation
          break
        case 'total':
          cmp = a.totalDue - b.totalDue
          break
        case 'iban':
          cmp = (a.recipientIban ? 1 : 0) - (b.recipientIban ? 1 : 0)
          break
        case 'status':
          cmp = a.paymentStatus.localeCompare(b.paymentStatus)
          break
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [filteredPayments, sortConfig])

  function toggleSort(column: SortColumn) {
    setSortConfig(prev => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' }
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  const hasActiveFilters =
    filters.athlete !== '' ||
    filters.recipient !== '' ||
    filters.event !== '' ||
    filters.iban !== 'all' ||
    filters.status !== 'all'

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
  const pendingTotal = filteredPayments
    .filter(p => p.paymentStatus === 'pending')
    .reduce((sum, p) => sum + p.totalDue, 0)
  const doneTotal = filteredPayments
    .filter(p => p.paymentStatus === 'done')
    .reduce((sum, p) => sum + p.totalDue, 0)

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between mb-4">
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

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 rounded-lg border items-center">
        <input
          type="text"
          placeholder={t('payments.filterByAthlete')}
          value={filters.athlete}
          onChange={e => setFilters(f => ({ ...f, athlete: e.target.value }))}
          className="text-sm border rounded px-2 py-1.5 min-w-[140px] bg-white"
        />
        <input
          type="text"
          placeholder={t('payments.filterByRecipient')}
          value={filters.recipient}
          onChange={e => setFilters(f => ({ ...f, recipient: e.target.value }))}
          className="text-sm border rounded px-2 py-1.5 min-w-[140px] bg-white"
        />
        <select
          value={filters.event}
          onChange={e => setFilters(f => ({ ...f, event: e.target.value }))}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="">{t('payments.allEvents')}</option>
          {allEventNames.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <select
          value={filters.iban}
          onChange={e => setFilters(f => ({ ...f, iban: e.target.value as FilterConfig['iban'] }))}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">{t('payments.allIban')}</option>
          <option value="present">{t('payments.ibanPresent')}</option>
          <option value="missing">{t('payments.ibanMissing')}</option>
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as FilterConfig['status'] }))}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">{t('payments.allStatuses')}</option>
          <option value="pending">{t('common.pending')}</option>
          <option value="done">{t('common.done')}</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-sm text-gray-500 hover:text-gray-700 underline px-1 py-1"
          >
            {t('payments.resetFilters')}
          </button>
        )}
        {hasActiveFilters && (
          <span className="text-xs text-gray-400 ml-auto">
            {sortedPayments.length} / {payments.length}
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('athlete')}
              >
                {t('payments.athlete')}
                <SortIcon column="athlete" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('recipient')}
              >
                {t('payments.recipient')}
                <SortIcon column="recipient" sortConfig={sortConfig} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">{t('payments.events')}</th>
              <th
                className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('appearanceFee')}
              >
                {t('payments.appearanceFee')}
                <SortIcon column="appearanceFee" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('prizeMoney')}
              >
                {t('payments.prizeMoney')}
                <SortIcon column="prizeMoney" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-right font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('otherCompensation')}
              >
                {t('payments.otherCompensation')}
                <SortIcon column="otherCompensation" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-right font-medium font-semibold cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('total')}
              >
                {t('payments.totalDue')}
                <SortIcon column="total" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('iban')}
              >
                {t('payments.iban')}
                <SortIcon column="iban" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('status')}
              >
                {t('payments.status')}
                <SortIcon column="status" sortConfig={sortConfig} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedPayments.map(p => (
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
            {sortedPayments.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-sm text-gray-400">
                  {t('payments.noResults')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {emailPreview && (
        <EmailPreviewModal emailPreview={emailPreview} onClose={() => setEmailPreview(null)} />
      )}
    </div>
  )
}

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@web/lib/api'
import { EmailPreviewModal } from '@web/pages/collaborator/athlete/modals'
import type { LogisticsEntry } from '@shared/types'

type SortColumn = 'athlete' | 'recipient' | 'travelMode' | 'status'
type SortDirection = 'asc' | 'desc'

interface SortConfig {
  column: SortColumn
  direction: SortDirection
}

interface FilterConfig {
  athlete: string
  recipient: string
  status: 'all' | 'complete' | 'pending'
}

const DEFAULT_FILTERS: FilterConfig = { athlete: '', recipient: '', status: 'all' }

const TRAVEL_MODE_KEY = {
  plane: 'logistics.byPlane',
  train: 'logistics.byTrain',
  road: 'logistics.byRoad',
} as const

function SortIcon({ column, sortConfig }: { column: SortColumn; sortConfig: SortConfig | null }) {
  if (!sortConfig || sortConfig.column !== column) {
    return <span className="ml-1 text-gray-300">↕</span>
  }
  return <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
}

export default function LogisticsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: entries = [], isLoading } = useQuery<LogisticsEntry[]>({
    queryKey: ['logistics'],
    queryFn: () => api.get('/api/v1/logistics'),
  })

  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string; htmlBody?: string } | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null)
  const [filters, setFilters] = useState<FilterConfig>(DEFAULT_FILTERS)

  const sendEmailMutation = useMutation({
    mutationFn: (athleteId: string) =>
      api.post<{ emailPreview: { subject: string; body: string; htmlBody: string } }>(
        `/api/v1/logistics/${athleteId}/send-email`
      ),
    onSuccess: (data) => {
      setEmailPreview(data.emailPreview)
      queryClient.invalidateQueries({ queryKey: ['logistics'] })
    },
  })

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const athleteName = `${e.athleteLastName} ${e.athleteFirstName}`.toLowerCase()
      if (filters.athlete && !athleteName.includes(filters.athlete.toLowerCase())) return false
      if (filters.recipient && !e.recipientName.toLowerCase().includes(filters.recipient.toLowerCase())) return false
      if (filters.status === 'complete' && !e.logisticsComplete) return false
      if (filters.status === 'pending' && e.logisticsComplete) return false
      return true
    })
  }, [entries, filters])

  const sortedEntries = useMemo(() => {
    if (!sortConfig) return filteredEntries
    return [...filteredEntries].sort((a, b) => {
      let cmp = 0
      switch (sortConfig.column) {
        case 'athlete':
          cmp = `${a.athleteLastName} ${a.athleteFirstName}`.localeCompare(`${b.athleteLastName} ${b.athleteFirstName}`)
          break
        case 'recipient':
          cmp = a.recipientName.localeCompare(b.recipientName)
          break
        case 'travelMode':
          cmp = (a.travelMode ?? '').localeCompare(b.travelMode ?? '')
          break
        case 'status':
          cmp = Number(a.logisticsComplete) - Number(b.logisticsComplete)
          break
      }
      return sortConfig.direction === 'asc' ? cmp : -cmp
    })
  }, [filteredEntries, sortConfig])

  function toggleSort(column: SortColumn) {
    setSortConfig(prev => {
      if (!prev || prev.column !== column) return { column, direction: 'asc' }
      return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
    })
  }

  const hasActiveFilters =
    filters.athlete !== '' ||
    filters.recipient !== '' ||
    filters.status !== 'all'

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 text-gray-400 text-sm">{t('common.loading')}</div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-2">{t('logisticsTracking.title')}</h1>
        <p className="text-gray-400 text-sm">{t('logisticsTracking.noAthletes')}</p>
      </div>
    )
  }

  const pendingCount = filteredEntries.filter(e => !e.logisticsComplete).length
  const completeCount = filteredEntries.filter(e => e.logisticsComplete).length

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">{t('logisticsTracking.title')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('logisticsTracking.subtitle')}</p>
        </div>
        <div className="flex gap-4 text-right">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <p className="text-xs text-amber-600 font-medium">{t('logisticsTracking.pending')}</p>
            <p className="text-lg font-bold text-amber-700">{pendingCount}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
            <p className="text-xs text-green-600 font-medium">{t('logisticsTracking.complete')}</p>
            <p className="text-lg font-bold text-green-700">{completeCount}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 rounded-lg border items-center">
        <input
          type="text"
          placeholder={t('logisticsTracking.filterByAthlete')}
          value={filters.athlete}
          onChange={e => setFilters(f => ({ ...f, athlete: e.target.value }))}
          className="text-sm border rounded px-2 py-1.5 min-w-[140px] bg-white"
        />
        <input
          type="text"
          placeholder={t('logisticsTracking.filterByRecipient')}
          value={filters.recipient}
          onChange={e => setFilters(f => ({ ...f, recipient: e.target.value }))}
          className="text-sm border rounded px-2 py-1.5 min-w-[140px] bg-white"
        />
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value as FilterConfig['status'] }))}
          className="text-sm border rounded px-2 py-1.5 bg-white"
        >
          <option value="all">{t('logisticsTracking.allStatuses')}</option>
          <option value="pending">{t('logisticsTracking.pending')}</option>
          <option value="complete">{t('logisticsTracking.complete')}</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="text-sm text-gray-500 hover:text-gray-700 underline px-1 py-1"
          >
            {t('logisticsTracking.resetFilters')}
          </button>
        )}
        {hasActiveFilters && (
          <span className="text-xs text-gray-400 ml-auto">
            {sortedEntries.length} / {entries.length}
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
                {t('logisticsTracking.athlete')}
                <SortIcon column="athlete" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('recipient')}
              >
                {t('logisticsTracking.recipient')}
                <SortIcon column="recipient" sortConfig={sortConfig} />
              </th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('travelMode')}
              >
                {t('logisticsTracking.travelMode')}
                <SortIcon column="travelMode" sortConfig={sortConfig} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">{t('logisticsTracking.arrival')}</th>
              <th className="px-3 py-2.5 text-left font-medium">{t('logisticsTracking.departure')}</th>
              <th
                className="px-3 py-2.5 text-left font-medium cursor-pointer hover:text-gray-700 select-none whitespace-nowrap"
                onClick={() => toggleSort('status')}
              >
                {t('logisticsTracking.status')}
                <SortIcon column="status" sortConfig={sortConfig} />
              </th>
              <th className="px-3 py-2.5 text-left font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(e => (
              <tr key={e.athleteId} className={`border-b hover:bg-gray-50 ${e.logisticsComplete ? 'opacity-60' : ''}`}>
                {/* Athlete */}
                <td className="px-3 py-2.5">
                  <Link
                    to={`/committee/athletes/${e.athleteId}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {e.athleteLastName}, {e.athleteFirstName}
                  </Link>
                </td>

                {/* Recipient */}
                <td className="px-3 py-2.5 text-xs text-gray-600">
                  <div className="font-medium">{e.recipientName}</div>
                  {e.managerId && (
                    <div className="text-gray-400">{t('manager.portal')}</div>
                  )}
                  {e.recipientEmail && (
                    <div className="text-gray-400 truncate max-w-[140px]">{e.recipientEmail}</div>
                  )}
                </td>

                {/* Travel mode */}
                <td className="px-3 py-2.5 text-xs">
                  {e.travelMode ? t(TRAVEL_MODE_KEY[e.travelMode]) : (
                    <span className="text-gray-400">{t('logisticsTracking.notSet')}</span>
                  )}
                </td>

                {/* Arrival */}
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {e.arrivalDate ? `${e.arrivalDate}${e.arrivalTime ? ` ${e.arrivalTime}` : ''}` : '—'}
                </td>

                {/* Departure */}
                <td className="px-3 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                  {e.departureDate ? `${e.departureDate}${e.departureTime ? ` ${e.departureTime}` : ''}` : '—'}
                </td>

                {/* Status */}
                <td className="px-3 py-2.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    e.logisticsComplete
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {e.logisticsComplete ? t('logisticsTracking.complete') : t('logisticsTracking.pending')}
                  </span>
                </td>

                {/* Actions */}
                <td className="px-3 py-2.5">
                  <button
                    onClick={async () => {
                      setSendingId(e.athleteId)
                      try {
                        await sendEmailMutation.mutateAsync(e.athleteId)
                      } finally {
                        setSendingId(null)
                      }
                    }}
                    disabled={sendingId === e.athleteId || !e.recipientEmail}
                    className="text-[10px] px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 whitespace-nowrap"
                  >
                    {sendingId === e.athleteId ? t('logisticsTracking.sending') : t('logisticsTracking.sendReminder')}
                  </button>
                </td>
              </tr>
            ))}
            {sortedEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-gray-400">
                  {t('logisticsTracking.noResults')}
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

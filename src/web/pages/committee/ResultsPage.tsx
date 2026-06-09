import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@web/lib/api'
import type { ResultAthleteEntry, ResultEventEntry, ResultsResponse } from '@shared/types'

function AthleteRow({ ath, event, currency, onSave }: {
  ath: ResultAthleteEntry
  event: ResultEventEntry
  currency: string
  onSave: (appId: string, placement: number | null) => Promise<void>
}) {
  const [draft, setDraft] = useState(ath.finalPlacement != null ? String(ath.finalPlacement) : '')
  const [saving, setSaving] = useState(false)

  const computePrizeMoney = (placement: number | null): number => {
    if (!placement || placement < 1 || placement > 8) return 0
    const slot = event.prizeSlots.find(s => s.place === placement)
    return slot?.amount ?? 0
  }

  const currentPlacement = draft.trim() ? parseInt(draft) : null
  const previewPrizeMoney = computePrizeMoney(currentPlacement)

  const handleBlur = async () => {
    const val = draft.trim()
    const placement = val ? parseInt(val) : null
    if (placement === ath.finalPlacement) return
    setSaving(true)
    try {
      await onSave(ath.applicationId, placement)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className="border-b hover:bg-gray-50">
      <td className="px-4 py-2.5">
        <Link
          to={`/committee/athletes/${ath.athleteId}`}
          className="font-medium text-blue-600 hover:underline text-sm"
          tabIndex={-1}
        >
          {ath.athleteLastName}, {ath.athleteFirstName}
        </Link>
      </td>
      <td className="px-4 py-2.5 text-center w-32">
        <input
          type="number"
          min="1"
          placeholder="—"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          disabled={saving}
          className={`w-16 text-center px-2 py-1 border rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${
            ath.finalPlacement != null
              ? 'border-blue-300 bg-blue-50 text-blue-800'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm w-40">
        {previewPrizeMoney > 0 ? (
          <span className={draft.trim() ? 'text-green-700 font-medium' : 'text-gray-400'}>
            {currency} {previewPrizeMoney.toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
    </tr>
  )
}

export default function ResultsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<ResultsResponse>({
    queryKey: ['results'],
    queryFn: () => api.get('/api/v1/results'),
  })

  const [activeEventId, setActiveEventId] = useState<string | null>(null)

  const placementMutation = useMutation({
    mutationFn: ({ appId, placement }: { appId: string; placement: number | null }) =>
      api.patch(`/api/v1/applications/${appId}/final-placement`, { finalPlacement: placement }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['results'] })
    },
  })

  if (isLoading) {
    return <div className="max-w-7xl mx-auto px-6 py-8 text-gray-400 text-sm">{t('common.loading')}</div>
  }

  const events = data?.events ?? []
  const currency = data?.currency ?? 'CHF'

  if (events.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="text-xl font-bold mb-2">{t('results.title')}</h1>
        <p className="text-gray-400 text-sm">{t('results.noEvents')}</p>
      </div>
    )
  }

  const currentEventId = activeEventId ?? events[0]?.eventId
  const currentEvent = events.find(e => e.eventId === currentEventId)

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold">{t('results.title')}</h1>
        <p className="text-sm text-gray-400 mt-0.5">{t('results.subtitle')}</p>
      </div>

      {/* Event tabs */}
      <div className="flex flex-wrap gap-2 mb-5">
        {events.map(ev => {
          const placed = ev.athletes.filter(a => a.finalPlacement != null).length
          const total = ev.athletes.length
          const isActive = ev.eventId === currentEventId
          return (
            <button
              key={ev.eventId}
              onClick={() => setActiveEventId(ev.eventId)}
              className={`px-3 py-1.5 text-sm rounded-md border flex items-center gap-2 transition-colors ${
                isActive
                  ? 'bg-gray-900 text-white border-gray-900 font-medium'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {ev.eventName}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                isActive
                  ? 'bg-white/20 text-white'
                  : placed === total && total > 0
                  ? 'bg-green-100 text-green-700'
                  : placed > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {placed}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {currentEvent && (
        <>
          {/* Prize money legend */}
          {currentEvent.prizeSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{t('results.prizeMoneyLegend')}:</span>
              {currentEvent.prizeSlots.map(slot => (
                <span key={slot.place} className="text-gray-500">
                  {t('results.place')} {slot.place} — {currency} {slot.amount.toLocaleString()}
                </span>
              ))}
            </div>
          )}

          {/* Athletes table */}
          {currentEvent.athletes.length === 0 ? (
            <p className="text-gray-400 text-sm">{t('results.noAthletes')}</p>
          ) : (
            <div className="bg-white rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-xs text-gray-500">
                    <th className="px-4 py-2.5 text-left font-medium">{t('results.athlete')}</th>
                    <th className="px-4 py-2.5 text-center font-medium w-32">{t('results.placement')}</th>
                    <th className="px-4 py-2.5 text-right font-medium w-40">{t('results.prizeMoney')}</th>
                  </tr>
                </thead>
                <tbody>
                  {currentEvent.athletes.map(ath => (
                    <AthleteRow
                      key={ath.applicationId}
                      ath={ath}
                      event={currentEvent}
                      currency={currency}
                      onSave={async (appId, placement) => {
                        await placementMutation.mutateAsync({ appId, placement })
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

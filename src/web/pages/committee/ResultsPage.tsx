import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '@web/lib/api'
import type { ResultAthleteEntry, ResultEventEntry, ResultsResponse } from '@shared/types'

const PRIZE_ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']
const PRIZE_FIELDS = [
  'prizeMoney1st', 'prizeMoney2nd', 'prizeMoney3rd', 'prizeMoney4th',
  'prizeMoney5th', 'prizeMoney6th', 'prizeMoney7th', 'prizeMoney8th',
] as const
type PrizeField = typeof PRIZE_FIELDS[number]

function PrizeMoneyEditor({ event, currency, onSave }: {
  event: ResultEventEntry
  currency: string
  onSave: (eventId: string, field: PrizeField, value: number) => Promise<void>
}) {
  const { t } = useTranslation()

  const [drafts, setDrafts] = useState<string[]>(() =>
    PRIZE_FIELDS.map((_, i) => {
      const slot = event.prizeSlots.find(s => s.place === i + 1)
      return slot && slot.amount > 0 ? String(slot.amount) : ''
    })
  )
  const [saving, setSaving] = useState<boolean[]>(Array(8).fill(false))

  const handleChange = (i: number, value: string) => {
    setDrafts(prev => { const next = [...prev]; next[i] = value; return next })
  }

  const handleBlur = async (i: number) => {
    const val = drafts[i].trim()
    const newAmount = val ? Math.max(0, parseInt(val) || 0) : 0
    const currentSlot = event.prizeSlots.find(s => s.place === i + 1)
    const currentAmount = currentSlot?.amount ?? 0
    if (newAmount === currentAmount) return

    setSaving(prev => { const next = [...prev]; next[i] = true; return next })
    try {
      await onSave(event.eventId, PRIZE_FIELDS[i], newAmount)
    } finally {
      setSaving(prev => { const next = [...prev]; next[i] = false; return next })
    }
  }

  return (
    <div className="mb-5">
      <p className="text-xs font-medium text-gray-700 mb-2">{t('results.prizeMoneyEdit')}</p>
      <div className="flex flex-wrap gap-2">
        {PRIZE_ORDINALS.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] text-gray-400 font-medium">{label}</span>
            <div className={`flex items-center gap-1 border rounded px-2 py-1 ${
              saving[i] ? 'opacity-50 bg-gray-50 border-gray-200' : 'bg-white border-gray-200 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400'
            }`}>
              <span className="text-xs text-gray-400">{currency}</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={drafts[i]}
                onChange={e => handleChange(i, e.target.value)}
                onBlur={() => handleBlur(i)}
                disabled={saving[i]}
                className="w-16 text-sm font-mono text-right focus:outline-none bg-transparent disabled:opacity-50"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

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

  const prizeMutation = useMutation({
    mutationFn: ({ eventId, field, value }: { eventId: string; field: PrizeField; value: number }) =>
      api.patch(`/api/v1/events/${eventId}`, { [field]: value }),
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
          {/* Prize money editor — key forces remount when switching events */}
          <PrizeMoneyEditor
            key={currentEvent.eventId}
            event={currentEvent}
            currency={currency}
            onSave={async (eventId, field, value) => {
              await prizeMutation.mutateAsync({ eventId, field, value })
            }}
          />

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

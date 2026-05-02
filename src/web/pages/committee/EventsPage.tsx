import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { inputCls, labelCls } from '@web/lib/ui-constants'
import type { EventCatalog } from '@shared/types'

interface EditionEvent {
  id: string
  editionId: string
  catalogId: string
  name: string
  discipline: string
  gender: string
  maxSlots: number
  intMinima: number
  swissMinima: number
  eapMinima: number | null
  meetRecord: number | null
  targetPerf: number | null
  swissQuota: number
  eapQuota: number
  prizeMoney1st: number
  prizeMoney2nd: number
  prizeMoney3rd: number
  prizeMoney4th: number
  prizeMoney5th: number
  prizeMoney6th: number
  prizeMoney7th: number
  prizeMoney8th: number
}

const PRIZE_KEYS = ['prizeMoney1st', 'prizeMoney2nd', 'prizeMoney3rd', 'prizeMoney4th', 'prizeMoney5th', 'prizeMoney6th', 'prizeMoney7th', 'prizeMoney8th'] as const

function defaultForm() {
  return {
    catalogId: '',
    maxSlots: 8,
    intMinima: 0,
    swissMinima: 0,
    eapMinima: '',
    meetRecord: '',
    targetPerf: '',
    swissQuota: 1,
    eapQuota: 1,
    prizeMoney1st: 0,
    prizeMoney2nd: 0,
    prizeMoney3rd: 0,
    prizeMoney4th: 0,
    prizeMoney5th: 0,
    prizeMoney6th: 0,
    prizeMoney7th: 0,
    prizeMoney8th: 0,
  }
}

export default function EventsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: events = [], isLoading } = useQuery<EditionEvent[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  const { data: catalog = [] } = useQuery<EventCatalog[]>({
    queryKey: ['event-catalog'],
    queryFn: () => api.get('/api/v1/event-catalog'),
  })

  const [form, setForm] = useState(defaultForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Catalog items not yet added as events
  const usedCatalogIds = new Set(events.map(e => e.catalogId))
  const availableCatalog = catalog.filter(c => !usedCatalogIds.has(c.id))

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/api/v1/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Record<string, unknown> & { id: string }) =>
      api.patch(`/api/v1/events/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      resetForm()
    },
  })

  const resetForm = () => {
    setForm(defaultForm())
    setEditingId(null)
    setShowForm(false)
  }

  const startEdit = (evt: EditionEvent) => {
    setEditingId(evt.id)
    setForm({
      catalogId: evt.catalogId,
      maxSlots: evt.maxSlots,
      intMinima: evt.intMinima,
      swissMinima: evt.swissMinima,
      eapMinima: evt.eapMinima != null ? String(evt.eapMinima) : '',
      meetRecord: evt.meetRecord != null ? String(evt.meetRecord) : '',
      targetPerf: evt.targetPerf != null ? String(evt.targetPerf) : '',
      swissQuota: evt.swissQuota,
      eapQuota: evt.eapQuota,
      prizeMoney1st: evt.prizeMoney1st,
      prizeMoney2nd: evt.prizeMoney2nd,
      prizeMoney3rd: evt.prizeMoney3rd,
      prizeMoney4th: evt.prizeMoney4th,
      prizeMoney5th: evt.prizeMoney5th,
      prizeMoney6th: evt.prizeMoney6th,
      prizeMoney7th: evt.prizeMoney7th,
      prizeMoney8th: evt.prizeMoney8th,
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Record<string, unknown> = {
      maxSlots: form.maxSlots,
      intMinima: form.intMinima,
      swissMinima: form.swissMinima,
      eapMinima: form.eapMinima ? parseFloat(form.eapMinima) : undefined,
      meetRecord: form.meetRecord ? parseFloat(form.meetRecord) : undefined,
      targetPerf: form.targetPerf ? parseFloat(form.targetPerf) : undefined,
      swissQuota: form.swissQuota,
      eapQuota: form.eapQuota,
      prizeMoney1st: form.prizeMoney1st,
      prizeMoney2nd: form.prizeMoney2nd,
      prizeMoney3rd: form.prizeMoney3rd,
      prizeMoney4th: form.prizeMoney4th,
      prizeMoney5th: form.prizeMoney5th,
      prizeMoney6th: form.prizeMoney6th,
      prizeMoney7th: form.prizeMoney7th,
      prizeMoney8th: form.prizeMoney8th,
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      createMutation.mutate({ catalogId: form.catalogId, ...payload })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const error = createMutation.error || updateMutation.error

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const setNum = (key: string, val: string) =>
    setForm(p => ({ ...p, [key]: parseInt(val) || 0 }))

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">{t('selection.participation')}</h1>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            disabled={availableCatalog.length === 0}
            className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {t('common.add')}
          </button>
        )}
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6 space-y-4">
          <h2 className="font-semibold text-sm">
            {editingId ? t('common.edit') : t('common.add')}
          </h2>

          {!editingId && (
            <div>
              <label className={labelCls}>{t('admin.eventCatalog')}</label>
              <select className={inputCls} value={form.catalogId}
                onChange={e => setForm(p => ({ ...p, catalogId: e.target.value }))}>
                <option value="">—</option>
                {availableCatalog.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.gender}) — {c.discipline}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('selection.maxSlots')}</label>
              <input type="number" className={inputCls} value={form.maxSlots}
                onChange={e => setNum('maxSlots', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t('selection.minima')} ({t('selection.international')})</label>
              <input type="number" step="0.01" className={inputCls} value={form.intMinima}
                onChange={e => setForm(p => ({ ...p, intMinima: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className={labelCls}>{t('selection.minima')} ({t('selection.swiss')})</label>
              <input type="number" step="0.01" className={inputCls} value={form.swissMinima}
                onChange={e => setForm(p => ({ ...p, swissMinima: parseFloat(e.target.value) || 0 }))} />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={labelCls}>{t('selection.minima')} ({t('selection.eap')})</label>
              <input type="number" step="0.01" className={inputCls} value={form.eapMinima}
                onChange={e => setForm(p => ({ ...p, eapMinima: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{t('selection.meetRecord')}</label>
              <input type="number" step="0.01" className={inputCls} value={form.meetRecord}
                onChange={e => setForm(p => ({ ...p, meetRecord: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>{t('dashboard.swissQuota')}</label>
              <input type="number" className={inputCls} value={form.swissQuota}
                onChange={e => setNum('swissQuota', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>{t('dashboard.eapQuota')}</label>
              <input type="number" className={inputCls} value={form.eapQuota}
                onChange={e => setNum('eapQuota', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('dashboard.totalPrizeMoney')} (1st–8th, CHF)</label>
            <div className="grid grid-cols-8 gap-2">
              {PRIZE_KEYS.map((key, i) => (
                <input key={key} type="number" className={inputCls} value={form[key]}
                  placeholder={`${i + 1}${['st','nd','rd'][i] ?? 'th'}`}
                  onChange={e => setNum(key, e.target.value)} />
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={isPending || (!editingId && !form.catalogId)}
              className="text-xs bg-gray-900 text-white px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50">
              {isPending ? t('common.loading') : editingId ? t('common.save') : t('common.add')}
            </button>
            <button type="button" onClick={resetForm}
              className="text-xs px-4 py-1.5 rounded border hover:bg-gray-50">
              {t('common.cancel')}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{(error as Error).message}</p>}
        </form>
      )}

      {/* Events table */}
      {events.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">
          {t('common.none')}
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left font-medium">{t('athlete.event')}</th>
                <th className="px-3 py-2 text-center font-medium">{t('selection.maxSlots')}</th>
                <th className="px-3 py-2 text-center font-medium">{t('selection.minima')} (Int)</th>
                <th className="px-3 py-2 text-center font-medium">{t('selection.minima')} (SUI)</th>
                <th className="px-3 py-2 text-center font-medium">{t('dashboard.swissQuota')}</th>
                <th className="px-3 py-2 text-center font-medium">{t('dashboard.eapQuota')}</th>
                <th className="px-3 py-2 text-center font-medium">{t('dashboard.totalPrizeMoney')}</th>
                <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map(evt => {
                const totalPrize = PRIZE_KEYS.reduce((sum, k) => sum + evt[k], 0)
                return (
                  <tr key={evt.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span className="font-medium">{evt.name}</span>
                      <span className="text-xs text-gray-400 ml-1">({evt.gender})</span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.maxSlots}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.intMinima}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.swissMinima}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.swissQuota}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.eapQuota}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">
                      {totalPrize > 0 ? `CHF ${totalPrize.toLocaleString()}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => startEdit(evt)}
                        className="text-xs text-blue-600 hover:text-blue-800">
                        {t('common.edit')}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

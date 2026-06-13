import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { inputCls, labelCls, formatPerf, parseHumanPerf } from '@web/lib/ui-constants'
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

function perfHint(discipline: string): string {
  return discipline === 'Concours' ? 'm.cm (ex: 21.50)' : 'ss.cc ou m:ss.cc (ex: 9.95 ou 1:45.30)'
}

function defaultForm() {
  return {
    catalogId: '',
    maxSlots: 8,
    intMinima: '',
    swissMinima: '',
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

const ORDINAL_SUFFIX = ['er', 'e', 'e', 'e', 'e', 'e', 'e', 'e']

const sectionCls = 'border rounded p-3 space-y-3'
const sectionTitleCls = 'text-xs font-semibold text-gray-400 uppercase tracking-wide'

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
  const [editingDiscipline, setEditingDiscipline] = useState<string>('')
  const [showForm, setShowForm] = useState(false)

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
    setEditingDiscipline('')
    setShowForm(false)
  }

  const startEdit = (evt: EditionEvent) => {
    setEditingId(evt.id)
    setEditingDiscipline(evt.discipline)
    setForm({
      catalogId: evt.catalogId,
      maxSlots: evt.maxSlots,
      intMinima: formatPerf(evt.intMinima, evt.discipline),
      swissMinima: formatPerf(evt.swissMinima, evt.discipline),
      eapMinima: evt.eapMinima != null ? formatPerf(evt.eapMinima, evt.discipline) : '',
      meetRecord: evt.meetRecord != null ? formatPerf(evt.meetRecord, evt.discipline) : '',
      targetPerf: evt.targetPerf != null ? formatPerf(evt.targetPerf, evt.discipline) : '',
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

  // Discipline for the form: from edited event or from selected catalog
  const formDiscipline = editingId
    ? editingDiscipline
    : (catalog.find(c => c.id === form.catalogId)?.discipline ?? '')

  const handleCatalogChange = (catalogId: string) => {
    setForm(p => ({ ...p, catalogId, intMinima: '', swissMinima: '', eapMinima: '', meetRecord: '', targetPerf: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const disc = formDiscipline
    const payload: Record<string, unknown> = {
      maxSlots: form.maxSlots,
      intMinima: parseHumanPerf(String(form.intMinima), disc) ?? 0,
      swissMinima: parseHumanPerf(String(form.swissMinima), disc) ?? 0,
      eapMinima: parseHumanPerf(form.eapMinima, disc),
      meetRecord: parseHumanPerf(form.meetRecord, disc),
      targetPerf: parseHumanPerf(form.targetPerf, disc),
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

  const setPerfStr = (key: string, val: string) =>
    setForm(p => ({ ...p, [key]: val }))

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold">{t('selection.participation')}</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          disabled={availableCatalog.length === 0}
          className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {t('common.add')}
        </button>
      </div>

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) resetForm() }}
        >
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-sm">
                {editingId
                  ? events.find(e => e.id === editingId)?.name
                  : t('common.add')}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable form body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
              {!editingId && (
                <div>
                  <label className={labelCls}>{t('admin.eventCatalog')}</label>
                  <select className={inputCls} value={form.catalogId}
                    onChange={e => handleCatalogChange(e.target.value)}>
                    <option value="">—</option>
                    {availableCatalog.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.gender}) — {c.discipline}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Section: Général */}
              <div className={sectionCls}>
                <p className={sectionTitleCls}>{t('admin.general')}</p>
                <div className="max-w-[120px]">
                  <label className={labelCls}>{t('selection.maxSlots')}</label>
                  <input type="number" className={inputCls} value={form.maxSlots}
                    onChange={e => setNum('maxSlots', e.target.value)} />
                </div>
              </div>

              {/* Section: Performances */}
              <div className={sectionCls}>
                <div className="flex items-baseline justify-between">
                  <p className={sectionTitleCls}>Performances</p>
                  {formDiscipline && (
                    <span className="text-xs text-gray-400 italic">{perfHint(formDiscipline)}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>{t('selection.minima')} ({t('selection.international')})</label>
                    <input type="text" inputMode="decimal" className={inputCls}
                      value={form.intMinima}
                      onChange={e => setPerfStr('intMinima', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('selection.minima')} ({t('selection.swiss')})</label>
                    <input type="text" inputMode="decimal" className={inputCls}
                      value={form.swissMinima}
                      onChange={e => setPerfStr('swissMinima', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('selection.minima')} ({t('selection.eap')}) <span className="font-normal text-gray-400">(opt.)</span></label>
                    <input type="text" inputMode="decimal" className={inputCls}
                      value={form.eapMinima}
                      onChange={e => setPerfStr('eapMinima', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('selection.meetRecord')} <span className="font-normal text-gray-400">(opt.)</span></label>
                    <input type="text" inputMode="decimal" className={inputCls}
                      value={form.meetRecord}
                      onChange={e => setPerfStr('meetRecord', e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>{t('selection.targetPerf')} <span className="font-normal text-gray-400">(opt.)</span></label>
                    <input type="text" inputMode="decimal" className={inputCls}
                      value={form.targetPerf}
                      onChange={e => setPerfStr('targetPerf', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Section: Quotas */}
              <div className={sectionCls}>
                <p className={sectionTitleCls}>{t('dashboard.quotas')}</p>
                <div className="grid grid-cols-2 gap-3 max-w-xs">
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
              </div>

              {/* Section: Prize Money */}
              <div className={sectionCls}>
                <p className={sectionTitleCls}>{t('results.prizeMoney')} (CHF)</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRIZE_KEYS.map((key, i) => (
                    <div key={key}>
                      <label className={labelCls}>{i + 1}{ORDINAL_SUFFIX[i]}</label>
                      <input type="text" inputMode="numeric" className={inputCls} value={form[key]}
                        onChange={e => setNum(key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{(error as Error).message}</p>}

              {/* Footer */}
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={isPending || (!editingId && !form.catalogId)}
                  className="text-xs bg-gray-900 text-white px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50">
                  {isPending ? t('common.loading') : t('common.save')}
                </button>
                <button type="button" onClick={resetForm}
                  className="text-xs px-4 py-1.5 rounded border hover:bg-gray-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                <th className="px-3 py-2 text-center font-medium">Min. Int</th>
                <th className="px-3 py-2 text-center font-medium">Min. SUI</th>
                <th className="px-3 py-2 text-center font-medium">Min. EAP</th>
                <th className="px-3 py-2 text-center font-medium">{t('selection.meetRecord')}</th>
                <th className="px-3 py-2 text-center font-medium">{t('selection.targetPerf')}</th>
                <th className="px-3 py-2 text-center font-medium">Q.SUI</th>
                <th className="px-3 py-2 text-center font-medium">Q.EAP</th>
                <th className="px-3 py-2 text-center font-medium">{t('dashboard.totalPrizeMoney')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map(evt => {
                const totalPrize = PRIZE_KEYS.reduce((sum, k) => sum + evt[k], 0)
                const disc = evt.discipline
                return (
                  <tr key={evt.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <button
                        onClick={() => startEdit(evt)}
                        className="font-medium text-left hover:underline text-gray-900"
                      >
                        {evt.name}
                      </button>
                      <span className="text-xs text-gray-400 ml-1">({evt.gender})</span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.maxSlots}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{formatPerf(evt.intMinima, disc)}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{formatPerf(evt.swissMinima, disc)}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{formatPerf(evt.eapMinima, disc)}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{formatPerf(evt.meetRecord, disc)}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{formatPerf(evt.targetPerf, disc)}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.swissQuota}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">{evt.eapQuota}</td>
                    <td className="px-3 py-2 text-center font-mono text-xs">
                      {totalPrize > 0 ? `CHF ${totalPrize.toLocaleString()}` : '—'}
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

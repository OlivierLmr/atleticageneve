import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { EventCatalog } from '@shared/types'

export default function EventCatalogPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery<EventCatalog[]>({
    queryKey: ['event-catalog'],
    queryFn: () => api.get('/api/v1/event-catalog'),
  })

  const [name, setName] = useState('')
  const [discipline, setDiscipline] = useState<'Course' | 'Concours'>('Course')
  const [gender, setGender] = useState<'M' | 'F'>('M')
  const [waName, setWaName] = useState('')
  const [waRankingSlug, setWaRankingSlug] = useState('')
  const [eaDiscipline, setEaDiscipline] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setDiscipline('Course')
    setGender('M')
    setWaName('')
    setWaRankingSlug('')
    setEaDiscipline('')
    setEditingId(null)
  }

  const buildPayload = () => ({
    name: name.trim(),
    discipline,
    gender,
    waName: waName.trim() || null,
    waRankingSlug: waRankingSlug.trim() || null,
    eaDiscipline: eaDiscipline.trim() || null,
  })

  const addMutation = useMutation({
    mutationFn: (data: ReturnType<typeof buildPayload>) => api.post('/api/v1/event-catalog', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-catalog'] }); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & ReturnType<typeof buildPayload>) =>
      api.patch(`/api/v1/event-catalog/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['event-catalog'] }); resetForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/event-catalog/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event-catalog'] }),
  })

  const startEdit = (item: EventCatalog) => {
    setEditingId(item.id)
    setName(item.name)
    setDiscipline(item.discipline as 'Course' | 'Concours')
    setGender(item.gender as 'M' | 'F')
    setWaName(item.waName ?? '')
    setWaRankingSlug(item.waRankingSlug ?? '')
    setEaDiscipline(item.eaDiscipline ?? '')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const payload = buildPayload()
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload })
    } else {
      addMutation.mutate(payload)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-6">
      <h1 className="text-lg font-bold mb-6">{t('admin.eventCatalog')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6 space-y-3">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('admin.eventName')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="M100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.discipline')}</label>
            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as 'Course' | 'Concours')}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="Course">Course</option>
              <option value="Concours">Concours</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('athlete.gender')}</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as 'M' | 'F')}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="M">{t('athlete.male')}</option>
              <option value="F">{t('athlete.female')}</option>
            </select>
          </div>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('admin.waName')}</label>
            <input
              type="text"
              value={waName}
              onChange={(e) => setWaName(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="100 Metres"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('admin.waRankingSlug')}</label>
            <input
              type="text"
              value={waRankingSlug}
              onChange={(e) => setWaRankingSlug(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="100m"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">{t('admin.eaDiscipline')}</label>
            <input
              type="text"
              value={eaDiscipline}
              onChange={(e) => setEaDiscipline(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="Women's 100m"
            />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending || updateMutation.isPending}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {editingId ? t('common.save') : t('common.add')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
              {t('common.cancel')}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">{t('admin.waDisciplineMapHint')}</p>
        <p className="text-xs text-gray-400">{t('admin.eaDisciplineHint')}</p>
      </form>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-medium">{t('admin.eventName')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.discipline')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('athlete.gender')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.waName')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.waRankingSlug')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.eaDiscipline')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{item.name}</td>
                <td className="px-3 py-2">{item.discipline}</td>
                <td className="px-3 py-2">{item.gender}</td>
                <td className="px-3 py-2 text-gray-600">{item.waName ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-400 font-mono text-xs">{item.waRankingSlug ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-gray-600">{item.eaDiscipline ?? <span className="text-gray-300">—</span>}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button onClick={() => startEdit(item)}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => { if (confirm(t('common.confirmDelete'))) deleteMutation.mutate(item.id) }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-400 text-xs">
                  {t('common.none')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

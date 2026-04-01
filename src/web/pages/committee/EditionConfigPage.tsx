import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { Edition } from '@shared/types'

export default function EditionConfigPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: edition, isLoading } = useQuery<Edition>({
    queryKey: ['edition'],
    queryFn: () => api.get('/api/v1/editions/current'),
  })

  const [form, setForm] = useState<Partial<Edition>>({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (edition) setForm(edition)
  }, [edition])

  const weightSum =
    (form.weightPB ?? 0) + (form.weightSB ?? 0) + (form.weightRanking ?? 0) + (form.weightCost ?? 0)

  const mutation = useMutation({
    mutationFn: (data: Partial<Edition>) => api.patch(`/api/v1/editions/${edition!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edition'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (weightSum !== 100) return
    const { id, createdAt, updatedAt, ...rest } = form as Edition
    mutation.mutate(rest)
  }

  const set = (key: keyof Edition, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }))

  if (isLoading || !edition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-6">
      <h1 className="text-lg font-bold mb-6">{t('admin.editionConfig')}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm mb-2">{t('admin.general')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('admin.editionName')} value={form.name ?? ''} onChange={(v) => set('name', v)} />
            <Field label={t('admin.year')} type="number" value={form.year ?? ''} onChange={(v) => set('year', Number(v))} />
            <Field label={t('admin.startDate')} type="date" value={form.startDate?.slice(0, 10) ?? ''} onChange={(v) => set('startDate', v)} />
            <Field label={t('admin.endDate')} type="date" value={form.endDate?.slice(0, 10) ?? ''} onChange={(v) => set('endDate', v)} />
            <Field label={t('admin.currency')} value={form.currency ?? ''} onChange={(v) => set('currency', v)} />
            <Field label={t('admin.totalBudget')} type="number" value={form.totalBudget ?? 0} onChange={(v) => set('totalBudget', Number(v))} />
            <Field label={t('admin.notificationEmail')} type="email" value={form.notificationEmail ?? ''} onChange={(v) => set('notificationEmail', v)} />
          </div>
        </div>

        {/* Costs */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm mb-2">{t('admin.costs')}</h2>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t('admin.stadiumMealCost')} type="number" value={form.stadiumMealCost ?? 0} onChange={(v) => set('stadiumMealCost', Number(v))} />
            <Field label={t('admin.transportAirportHotel')} type="number" value={form.transportAirportHotelCost ?? 0} onChange={(v) => set('transportAirportHotelCost', Number(v))} />
            <Field label={t('admin.transportHotelStadium')} type="number" value={form.transportHotelStadiumCost ?? 0} onChange={(v) => set('transportHotelStadiumCost', Number(v))} />
          </div>
        </div>

        {/* Scoring weights */}
        <div className="bg-white rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold text-sm mb-2">{t('admin.scoringWeights')}</h2>
          <div className="grid grid-cols-5 gap-3">
            <Field label="PB" type="number" value={form.weightPB ?? 0} onChange={(v) => set('weightPB', Number(v))} />
            <Field label="SB" type="number" value={form.weightSB ?? 0} onChange={(v) => set('weightSB', Number(v))} />
            <Field label={t('admin.ranking')} type="number" value={form.weightRanking ?? 0} onChange={(v) => set('weightRanking', Number(v))} />
            <Field label={t('admin.cost')} type="number" value={form.weightCost ?? 0} onChange={(v) => set('weightCost', Number(v))} />
            <Field label={t('admin.eapBonus')} type="number" value={form.bonusEap ?? 0} onChange={(v) => set('bonusEap', Number(v))} />
          </div>
          <div className={`text-sm font-medium ${weightSum === 100 ? 'text-green-600' : 'text-red-600'}`}>
            {t('admin.weightSum')}: {weightSum}/100
            {weightSum !== 100 && <span className="ml-2">{t('admin.weightSumError')}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending || weightSum !== 100}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
          >
            {mutation.isPending ? t('common.loading') : t('common.save')}
          </button>
          {saved && <span className="text-sm text-green-600">{t('admin.saved')}</span>}
          {mutation.isError && <span className="text-sm text-red-600">{(mutation.error as Error)?.message || t('common.error')}</span>}
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
    </div>
  )
}

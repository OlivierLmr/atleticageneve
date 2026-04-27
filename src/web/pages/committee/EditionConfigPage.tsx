import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { Edition, CostTierConfig, CostDistanceConfig } from '@shared/types'

interface CostConfigs {
  tierConfigs: CostTierConfig[]
  distanceConfigs: CostDistanceConfig[]
}

export default function EditionConfigPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: edition, isLoading } = useQuery<Edition>({
    queryKey: ['edition'],
    queryFn: () => api.get('/api/v1/editions/current'),
  })

  const { data: costConfigs } = useQuery<CostConfigs>({
    queryKey: ['edition-cost-configs', edition?.id],
    queryFn: () => api.get(`/api/v1/editions/${edition!.id}/cost-configs`),
    enabled: !!edition?.id,
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
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-8">
      <h1 className="text-lg font-bold">{t('admin.editionConfig')}</h1>

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

      {/* Estimated cost configuration */}
      <CostConfigSection edition={edition} costConfigs={costConfigs ?? { tierConfigs: [], distanceConfigs: [] }} />
    </div>
  )
}

// ── Cost Config Section ───────────────────────────────────────────────────────

interface TierRow {
  tier: number
  rankingMin: string
  rankingMax: string
  appearanceFee: string
  nightlyRate: string
}

interface DistanceRow {
  distanceMax: string
  travelCost: string
  nights: string
}

function CostConfigSection({ edition, costConfigs }: { edition: Edition; costConfigs: CostConfigs }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [managerBonus, setManagerBonus] = useState(String(edition.managerTierBonus ?? 1))
  const [tiers, setTiers] = useState<TierRow[]>([])
  const [distances, setDistances] = useState<DistanceRow[]>([])
  const [tierSaved, setTierSaved] = useState(false)
  const [distSaved, setDistSaved] = useState(false)
  const [bonusSaved, setBonusSaved] = useState(false)

  useEffect(() => {
    setTiers(costConfigs.tierConfigs.map(tc => ({
      tier: tc.tier,
      rankingMin: tc.rankingMin != null ? String(tc.rankingMin) : '',
      rankingMax: tc.rankingMax != null ? String(tc.rankingMax) : '',
      appearanceFee: String(tc.appearanceFee),
      nightlyRate: String(tc.nightlyRate),
    })))
  }, [costConfigs.tierConfigs])

  useEffect(() => {
    setDistances(costConfigs.distanceConfigs.map(dc => ({
      distanceMax: dc.distanceMax != null ? String(dc.distanceMax) : '',
      travelCost: String(dc.travelCost),
      nights: String(dc.nights),
    })))
  }, [costConfigs.distanceConfigs])

  const bonusMutation = useMutation({
    mutationFn: () => api.patch(`/api/v1/editions/${edition.id}`, { managerTierBonus: Math.max(0, parseInt(managerBonus, 10) || 0) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edition'] })
      setBonusSaved(true)
      setTimeout(() => setBonusSaved(false), 2000)
    },
  })

  const tierMutation = useMutation({
    mutationFn: (data: object[]) => api.put(`/api/v1/editions/${edition.id}/cost-tier-configs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edition-cost-configs', edition.id] })
      setTierSaved(true)
      setTimeout(() => setTierSaved(false), 2000)
    },
  })

  const distMutation = useMutation({
    mutationFn: (data: object[]) => api.put(`/api/v1/editions/${edition.id}/cost-distance-configs`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['edition-cost-configs', edition.id] })
      setDistSaved(true)
      setTimeout(() => setDistSaved(false), 2000)
    },
  })

  const addTier = () => {
    const nextTier = tiers.length > 0 ? Math.max(...tiers.map(t => t.tier)) + 1 : 1
    setTiers(prev => [...prev, { tier: nextTier, rankingMin: '', rankingMax: '', appearanceFee: '0', nightlyRate: '0' }])
  }

  const removeTier = (idx: number) => setTiers(prev => prev.filter((_, i) => i !== idx))

  const setTierField = (idx: number, field: keyof TierRow, value: string) =>
    setTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))

  const saveTiers = () => {
    const payload = tiers.map(t => ({
      tier: parseInt(String(t.tier), 10),
      rankingMin: t.rankingMin !== '' ? parseInt(t.rankingMin, 10) : null,
      rankingMax: t.rankingMax !== '' ? parseInt(t.rankingMax, 10) : null,
      appearanceFee: parseInt(t.appearanceFee, 10) || 0,
      nightlyRate: parseInt(t.nightlyRate, 10) || 0,
    }))
    tierMutation.mutate(payload)
  }

  const addDistance = () => setDistances(prev => [...prev, { distanceMax: '', travelCost: '0', nights: '0' }])

  const removeDistance = (idx: number) => setDistances(prev => prev.filter((_, i) => i !== idx))

  const setDistField = (idx: number, field: keyof DistanceRow, value: string) =>
    setDistances(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d))

  const saveDistances = () => {
    const payload = distances.map(d => ({
      distanceMax: d.distanceMax !== '' ? parseInt(d.distanceMax, 10) : null,
      travelCost: parseInt(d.travelCost, 10) || 0,
      nights: parseInt(d.nights, 10) || 0,
    }))
    distMutation.mutate(payload)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-bold">{t('admin.estimatedCostConfig')}</h2>

      {/* Manager tier bonus */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.managerTierBonus')}</label>
            <p className="text-xs text-gray-400 mb-2">{t('admin.managerTierBonusHint')}</p>
            <input
              type="number"
              min={0}
              value={managerBonus}
              onChange={(e) => setManagerBonus(e.target.value)}
              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => bonusMutation.mutate()}
              disabled={bonusMutation.isPending}
              className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
            >
              {bonusMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
            {bonusSaved && <span className="text-sm text-green-600">{t('admin.saved')}</span>}
          </div>
        </div>
      </div>

      {/* Tier configs */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-sm mb-3">{t('admin.tierConfigs')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-2 py-2 text-left font-medium">{t('admin.tier')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.rankingMin')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.rankingMax')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.appearanceFee')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.nightlyRate')}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {tiers.map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-2 py-1.5">
                    <input type="number" min={1} value={row.tier}
                      onChange={(e) => setTierField(idx, 'tier', e.target.value)}
                      className="w-16 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={1} value={row.rankingMin} placeholder={t('admin.noLimit')}
                      onChange={(e) => setTierField(idx, 'rankingMin', e.target.value)}
                      className="w-24 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={1} value={row.rankingMax} placeholder={t('admin.noLimit')}
                      onChange={(e) => setTierField(idx, 'rankingMax', e.target.value)}
                      className="w-24 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} value={row.appearanceFee}
                      onChange={(e) => setTierField(idx, 'appearanceFee', e.target.value)}
                      className="w-28 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} value={row.nightlyRate}
                      onChange={(e) => setTierField(idx, 'nightlyRate', e.target.value)}
                      className="w-24 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => removeTier(idx)}
                      className="text-xs text-red-600 hover:text-red-800">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={addTier}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1">
            + {t('admin.addRow')}
          </button>
          <button type="button" onClick={saveTiers} disabled={tierMutation.isPending}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50">
            {tierMutation.isPending ? t('common.loading') : t('admin.saveTiers')}
          </button>
          {tierSaved && <span className="text-sm text-green-600">{t('admin.saved')}</span>}
          {tierMutation.isError && <span className="text-sm text-red-600">{t('common.error')}</span>}
        </div>
      </div>

      {/* Distance configs */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="font-semibold text-sm mb-3">{t('admin.distanceConfigs')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-2 py-2 text-left font-medium">{t('admin.distanceMax')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.travelCost')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('admin.nights')}</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {distances.map((row, idx) => (
                <tr key={idx} className="border-b">
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} value={row.distanceMax} placeholder={t('admin.noLimit')}
                      onChange={(e) => setDistField(idx, 'distanceMax', e.target.value)}
                      className="w-32 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} value={row.travelCost}
                      onChange={(e) => setDistField(idx, 'travelCost', e.target.value)}
                      className="w-28 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <input type="number" min={0} value={row.nights}
                      onChange={(e) => setDistField(idx, 'nights', e.target.value)}
                      className="w-20 px-1.5 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900" />
                  </td>
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => removeDistance(idx)}
                      className="text-xs text-red-600 hover:text-red-800">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button type="button" onClick={addDistance}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1">
            + {t('admin.addRow')}
          </button>
          <button type="button" onClick={saveDistances} disabled={distMutation.isPending}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50">
            {distMutation.isPending ? t('common.loading') : t('admin.saveDistances')}
          </button>
          {distSaved && <span className="text-sm text-green-600">{t('admin.saved')}</span>}
          {distMutation.isError && <span className="text-sm text-red-600">{t('common.error')}</span>}
        </div>
      </div>
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

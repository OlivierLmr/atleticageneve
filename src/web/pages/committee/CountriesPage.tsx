import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { Country } from '@shared/types'

export default function CountriesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: countries = [], isLoading } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: () => api.get('/api/v1/countries'),
  })

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [distance, setDistance] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)

  const resetForm = () => { setCode(''); setName(''); setDistance(''); setEditingCode(null) }

  const addMutation = useMutation({
    mutationFn: (data: { code: string; name: string; distanceFromGva: number }) => api.post('/api/v1/countries', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['countries'] }); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ code: c, name: n, distanceFromGva: d }: { code: string; name: string; distanceFromGva: number }) =>
      api.patch(`/api/v1/countries/${c}`, { name: n, distanceFromGva: d }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['countries'] }); resetForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (countryCode: string) => api.delete(`/api/v1/countries/${countryCode}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['countries'] }),
  })

  const startEdit = (c: Country) => {
    setEditingCode(c.code)
    setCode(c.code)
    setName(c.name)
    setDistance(String(c.distanceFromGva))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    const distanceFromGva = Math.max(0, parseInt(distance, 10) || 0)
    if (editingCode) {
      updateMutation.mutate({ code: editingCode, name: name.trim(), distanceFromGva })
    } else {
      addMutation.mutate({ code: code.trim().toUpperCase(), name: name.trim(), distanceFromGva })
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
    <div className="max-w-3xl mx-auto py-8 px-6">
      <h1 className="text-lg font-bold mb-6">{t('admin.countries')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6 flex items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('admin.countryCode')}</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={3}
            disabled={!!editingCode}
            className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-100"
            placeholder="SUI"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">{t('admin.countryName')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Switzerland"
          />
        </div>
        <div className="w-32">
          <label className="block text-xs text-gray-500 mb-1">{t('admin.distanceFromGva')} (km)</label>
          <input
            type="number"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            min={0}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="0"
          />
        </div>
        <button
          type="submit"
          disabled={addMutation.isPending || updateMutation.isPending}
          className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
        >
          {editingCode ? t('common.save') : t('common.add')}
        </button>
        {editingCode && (
          <button type="button" onClick={resetForm}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5">
            {t('common.cancel')}
          </button>
        )}
      </form>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-medium">{t('admin.countryCode')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.countryName')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('admin.distanceFromGva')} (km)</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {countries.map((c) => (
              <tr key={c.code} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-mono">{c.code}</td>
                <td className="px-3 py-2">{c.name}</td>
                <td className="px-3 py-2 text-right font-mono">{c.distanceFromGva.toLocaleString()}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button onClick={() => startEdit(c)}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(c.code)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {countries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-400 text-xs">
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

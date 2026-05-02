import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { EapCity, Country } from '@shared/types'

export default function EapCitiesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: cities = [], isLoading } = useQuery<EapCity[]>({
    queryKey: ['eap-cities'],
    queryFn: () => api.get('/api/v1/eap-cities'),
  })

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: () => api.get('/api/v1/countries'),
  })

  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const resetForm = () => { setName(''); setCountryCode(''); setEditingId(null) }

  const addMutation = useMutation({
    mutationFn: (data: { name: string; countryCode: string }) => api.post('/api/v1/eap-cities', data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eap-cities'] }); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name: string; countryCode: string }) =>
      api.patch(`/api/v1/eap-cities/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['eap-cities'] }); resetForm() },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/eap-cities/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['eap-cities'] }),
  })

  const startEdit = (city: EapCity) => {
    setEditingId(city.id)
    setName(city.name)
    setCountryCode(city.countryCode)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !countryCode.trim()) return
    if (editingId) {
      updateMutation.mutate({ id: editingId, name: name.trim(), countryCode: countryCode.trim() })
    } else {
      addMutation.mutate({ name: name.trim(), countryCode: countryCode.trim() })
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
      <h1 className="text-lg font-bold mb-6">{t('admin.eapCities')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">{t('admin.cityName')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            placeholder="Lyon"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">{t('admin.countryCode')}</label>
          {countries.length > 0 ? (
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">--</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              maxLength={3}
              className="w-24 px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="FRA"
            />
          )}
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
      </form>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-medium">{t('admin.cityName')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.countryCode')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {cities.map((city) => (
              <tr key={city.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">{city.name}</td>
                <td className="px-3 py-2 font-mono">{city.countryCode}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button onClick={() => startEdit(city)}
                    className="text-xs text-blue-600 hover:text-blue-800">
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => { if (confirm(t('common.confirmDelete'))) deleteMutation.mutate(city.id) }}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {cities.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-400 text-xs">
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

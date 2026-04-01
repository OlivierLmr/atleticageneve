import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import type { Event, EapCity, Country } from '@shared/types'

// Events API returns Event joined with catalog data
interface EventWithCatalog extends Event {
  name: string
  discipline: string
  gender: string
  perfType: string
}

interface AthleteRow {
  key: string
  lastName: string
  firstName: string
  nationality: string
  dateOfBirth: string
  gender: 'M' | 'F' | ''
  isEap: boolean
  eapCity: string
  waProfileUrl: string
  eventIds: string[]
}

const emptyRow = (): AthleteRow => ({
  key: crypto.randomUUID(),
  lastName: '', firstName: '', nationality: '',
  dateOfBirth: '', gender: '', isEap: false, eapCity: '',
  waProfileUrl: '', eventIds: [],
})

export default function ManagerRegisterPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [rows, setRows] = useState<AthleteRow[]>([emptyRow()])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [registeredCount, setRegisteredCount] = useState(0)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const { data: eapCities = [] } = useQuery<EapCity[]>({
    queryKey: ['eap-cities'],
    queryFn: () => api.get('/api/v1/eap-cities'),
    enabled: rows.some(r => r.isEap),
  })

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: () => api.get('/api/v1/countries'),
  })

  const { data: events = [] } = useQuery<EventWithCatalog[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  const updateRow = (key: string, field: string, value: string | boolean | string[]) => {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r
      // When gender changes, clear eventIds since events are gender-specific
      if (field === 'gender') return { ...r, gender: value as 'M' | 'F' | '', eventIds: [] }
      return { ...r, [field]: value }
    }))
  }

  const toggleEvent = (key: string, eventId: string) => {
    setRows(prev => prev.map(r => {
      if (r.key !== key) return r
      const ids = r.eventIds.includes(eventId)
        ? r.eventIds.filter(id => id !== eventId)
        : [...r.eventIds, eventId]
      return { ...r, eventIds: ids }
    }))
  }

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const removeRow = (key: string) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.key !== key))
    if (expandedRow === key) setExpandedRow(null)
  }

  const validRows = rows.filter(r => r.firstName && r.lastName && r.gender && r.eventIds.length > 0)

  const handleSubmit = async () => {
    if (validRows.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const athletes = validRows.map(r => ({
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality || 'UNK',
        gender: r.gender as 'M' | 'F',
        eventIds: r.eventIds,
        isEap: r.isEap,
        eapCity: r.eapCity || undefined,
        isSwiss: r.nationality === 'SUI',
        waProfileUrl: r.waProfileUrl || undefined,
        dateOfBirth: r.dateOfBirth || undefined,
      }))
      const res = await api.post<{ registered: unknown[] }>('/api/v1/athletes/batch', { athletes })
      setRegisteredCount(res.registered.length)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold mb-2">Atletica Genève</h1>
          <div className="bg-white rounded-lg border p-6">
            <div className="text-3xl mb-3">&#10003;</div>
            <p className="font-semibold text-sm mb-1">{registeredCount} athletes registered</p>
            <p className="text-xs text-gray-500">Applications have been submitted for review.</p>
          </div>
          <div className="flex gap-3 justify-center mt-4">
            <Link to="/manager/portal" className="text-xs text-gray-600 underline">{t('manager.portal')}</Link>
            <Link to="/" className="text-xs text-gray-400 underline">{t('common.back')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-gray-900'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold">{t('manager.batchRegister')}</h1>
            {user && <p className="text-xs text-gray-400">{user.firstName} {user.lastName} — {user.email}</p>}
          </div>
          <LanguageSwitcher />
        </div>

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-2 py-2 text-left font-medium">{t('athlete.lastName')} *</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.firstName')} *</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.dateOfBirth')}</th>
                <th className="px-2 py-2 text-left font-medium w-16">NAT</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.gender')} *</th>
                <th className="px-2 py-2 text-left font-medium w-10">EAP</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.waProfile')}</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.event')}(s) *</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const filteredEvents = events.filter(e => e.id !== 'all' && (!row.gender || e.gender === row.gender))
                return (
                  <tr key={row.key} className="border-b align-top">
                    <td className="px-1 py-1"><input className={inputCls} value={row.lastName} onChange={e => updateRow(row.key, 'lastName', e.target.value)} /></td>
                    <td className="px-1 py-1"><input className={inputCls} value={row.firstName} onChange={e => updateRow(row.key, 'firstName', e.target.value)} /></td>
                    <td className="px-1 py-1"><input type="date" className={inputCls} value={row.dateOfBirth} onChange={e => updateRow(row.key, 'dateOfBirth', e.target.value)} /></td>
                    <td className="px-1 py-1"><input className={inputCls} list="nat-list" value={row.nationality} onChange={e => updateRow(row.key, 'nationality', e.target.value.toUpperCase())} maxLength={3} /></td>
                    <td className="px-1 py-1">
                      <select className={inputCls} value={row.gender} onChange={e => updateRow(row.key, 'gender', e.target.value)}>
                        <option value="">—</option>
                        <option value="M">{t('athlete.male')}</option>
                        <option value="F">{t('athlete.female')}</option>
                      </select>
                    </td>
                    <td className="px-1 py-1 text-center">
                      <input type="checkbox" checked={row.isEap} onChange={e => { updateRow(row.key, 'isEap', e.target.checked); if (!e.target.checked) updateRow(row.key, 'eapCity', '') }} />
                      {row.isEap && (
                        <select className={`${inputCls} mt-1`} value={row.eapCity} onChange={e => updateRow(row.key, 'eapCity', e.target.value)}>
                          <option value="">--</option>
                          {eapCities.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-1 py-1"><input className={inputCls} value={row.waProfileUrl} onChange={e => updateRow(row.key, 'waProfileUrl', e.target.value)} placeholder="worldathletics.org/..." /></td>
                    <td className="px-1 py-1">
                      {!row.gender ? (
                        <span className="text-gray-400 text-xs">{t('athlete.gender')}...</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setExpandedRow(expandedRow === row.key ? null : row.key)}
                          className={`${inputCls} text-left ${row.eventIds.length > 0 ? 'text-gray-900' : 'text-gray-400'}`}
                        >
                          {row.eventIds.length > 0
                            ? `${row.eventIds.length} ${t('athlete.event')}(s)`
                            : `— ${t('athlete.event')}(s)`}
                        </button>
                      )}
                      {expandedRow === row.key && row.gender && (
                        <div className="absolute z-10 mt-1 bg-white border rounded shadow-lg p-2 max-h-48 overflow-y-auto">
                          {filteredEvents.map(e => (
                            <label key={e.id} className="flex items-center gap-2 p-1 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={row.eventIds.includes(e.id)}
                                onChange={() => toggleEvent(row.key, e.id)}
                                className="accent-gray-900"
                              />
                              <span className="text-xs">{e.name}</span>
                            </label>
                          ))}
                          {filteredEvents.length === 0 && (
                            <p className="text-xs text-gray-400 p-1">No events</p>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <button
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
                        className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        &#x2715;
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <datalist id="nat-list">
          {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </datalist>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="text-xs text-gray-600 hover:text-gray-900 border rounded px-3 py-1.5">
            + {t('manager.addAthlete')}
          </button>

          <div className="flex items-center gap-3">
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Link to="/signup" className="text-xs text-gray-400 underline">{t('common.back')}</Link>
            <button
              onClick={handleSubmit}
              disabled={submitting || validRows.length === 0}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('common.loading') : `${t('common.submit')} (${validRows.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

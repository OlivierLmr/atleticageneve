import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import type { Event } from '@shared/types'

interface AthleteRow {
  key: string
  lastName: string
  firstName: string
  email: string
  nationality: string
  dateOfBirth: string
  federation: string
  isEap: boolean
  eventId: string
  personalBest: string
  seasonBest: string
  waProfileUrl: string
}

const emptyRow = (): AthleteRow => ({
  key: crypto.randomUUID(),
  lastName: '', firstName: '', email: '', nationality: '',
  dateOfBirth: '', federation: '', isEap: false,
  eventId: '', personalBest: '', seasonBest: '', waProfileUrl: '',
})

export default function ManagerRegisterPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [rows, setRows] = useState<AthleteRow[]>([emptyRow()])
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [registeredCount, setRegisteredCount] = useState(0)

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  const updateRow = (key: string, field: string, value: string | boolean) => {
    setRows(prev => prev.map(r => r.key === key ? { ...r, [field]: value } : r))
  }

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const removeRow = (key: string) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter(r => r.key !== key))
  }

  const validRows = rows.filter(r => r.firstName && r.lastName && r.eventId && r.personalBest && r.seasonBest)

  const handleSubmit = async () => {
    if (validRows.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const athletes = validRows.map(r => ({
        firstName: r.firstName,
        lastName: r.lastName,
        nationality: r.nationality || 'UNK',
        gender: 'M' as const, // TODO: add gender column to batch form
        eventId: r.eventId,
        personalBest: r.personalBest,
        seasonBest: r.seasonBest,
        isEap: r.isEap,
        isSwiss: r.nationality === 'SUI',
        athleteEmail: r.email || undefined,
        federation: r.federation || undefined,
        waProfileUrl: r.waProfileUrl || undefined,
        dateOfBirth: r.dateOfBirth || undefined,
      }))
      const res = await api.post<{ registered: unknown[] }>('/api/v1/athletes/batch', { athletes })
      setRegisteredCount(res.registered.length)
      setSubmitted(true)
    } catch {
      setError(t('common.error'))
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
      <div className="max-w-6xl mx-auto">
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
                <th className="px-2 py-2 text-left font-medium">{t('auth.email')}</th>
                <th className="px-2 py-2 text-left font-medium w-16">NAT</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.federation')}</th>
                <th className="px-2 py-2 text-left font-medium w-10">EAP</th>
                <th className="px-2 py-2 text-left font-medium">{t('athlete.event')} *</th>
                <th className="px-2 py-2 text-left font-medium">PB *</th>
                <th className="px-2 py-2 text-left font-medium">SB *</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b">
                  <td className="px-1 py-1"><input className={inputCls} value={row.lastName} onChange={e => updateRow(row.key, 'lastName', e.target.value)} /></td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.firstName} onChange={e => updateRow(row.key, 'firstName', e.target.value)} /></td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.email} onChange={e => updateRow(row.key, 'email', e.target.value)} /></td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.nationality} onChange={e => updateRow(row.key, 'nationality', e.target.value.toUpperCase())} maxLength={3} /></td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.federation} onChange={e => updateRow(row.key, 'federation', e.target.value)} /></td>
                  <td className="px-1 py-1 text-center">
                    <input type="checkbox" checked={row.isEap} onChange={e => updateRow(row.key, 'isEap', e.target.checked)} />
                  </td>
                  <td className="px-1 py-1">
                    <select className={inputCls} value={row.eventId} onChange={e => updateRow(row.key, 'eventId', e.target.value)}>
                      <option value="">—</option>
                      {events.filter(e => e.id !== 'all').map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.personalBest} onChange={e => updateRow(row.key, 'personalBest', e.target.value)} placeholder="9.80" /></td>
                  <td className="px-1 py-1"><input className={inputCls} value={row.seasonBest} onChange={e => updateRow(row.key, 'seasonBest', e.target.value)} placeholder="9.95" /></td>
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
              ))}
            </tbody>
          </table>
        </div>

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

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { LanguageSwitcher } from '@web/App'
import type { Event } from '@shared/types'

const STEPS = ['athlete', 'competition', 'compliance', 'travel'] as const
type Step = (typeof STEPS)[number]

export default function AthleteRegisterPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('athlete')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: () => api.get('/api/v1/events'),
  })

  // Form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', gender: '' as 'M' | 'F' | '',
    dateOfBirth: '', phone: '', email: '', nationality: '',
    federation: '', isEap: false, swiLicence: '',
    // Competition
    eventId: '', personalBest: '', seasonBest: '', worldRanking: '',
    waProfileUrl: '',
    // Compliance
    iRunClean: 'unknown' as 'yes' | 'no' | 'in_progress' | 'unknown',
    dopingFree: 'unknown' as 'yes' | 'no' | 'unknown',
    // Travel
    participantNotes: '', additionalNotes: '',
  })

  const update = (field: string, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const stepIndex = STEPS.indexOf(step)
  const canNext = () => {
    if (step === 'athlete') return form.firstName && form.lastName && form.gender && form.nationality
    if (step === 'competition') return form.eventId && form.personalBest && form.seasonBest
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      await api.post('/api/v1/athletes', {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        nationality: form.nationality,
        federation: form.federation || undefined,
        isEap: form.isEap,
        isSwiss: form.nationality === 'SUI',
        swiLicence: form.swiLicence || undefined,
        athleteEmail: form.email || undefined,
        athletePhone: form.phone || undefined,
        eventId: form.eventId,
        personalBest: form.personalBest,
        seasonBest: form.seasonBest,
        worldRanking: form.worldRanking ? parseInt(form.worldRanking) : undefined,
        waProfileUrl: form.waProfileUrl || undefined,
        iRunClean: form.iRunClean,
        dopingFree: form.dopingFree,
        participantNotes: form.participantNotes || undefined,
        additionalNotes: form.additionalNotes || undefined,
      })
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
            <p className="font-semibold text-sm mb-1">{t('athlete.registration')} — {form.firstName} {form.lastName}</p>
            <p className="text-xs text-gray-500">Your application has been submitted successfully.</p>
          </div>
          <Link to="/" className="text-xs text-gray-400 underline mt-4 inline-block">{t('common.back')}</Link>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold">{t('athlete.registration')}</h1>
          <LanguageSwitcher />
        </div>

        {/* Step indicator */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded ${i <= stepIndex ? 'bg-gray-900' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="bg-white rounded-lg border p-6 space-y-4">
          {step === 'athlete' && (
            <>
              <h2 className="font-semibold text-sm mb-2">{t('athlete.firstName')} & {t('athlete.lastName')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.firstName')} *</label>
                  <input className={inputCls} value={form.firstName} onChange={e => update('firstName', e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.lastName')} *</label>
                  <input className={inputCls} value={form.lastName} onChange={e => update('lastName', e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.gender')} *</label>
                  <select className={inputCls} value={form.gender} onChange={e => update('gender', e.target.value)}>
                    <option value="">—</option>
                    <option value="M">{t('athlete.male')}</option>
                    <option value="F">{t('athlete.female')}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.dateOfBirth')}</label>
                  <input type="date" className={inputCls} value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.nationality')} *</label>
                  <input className={inputCls} value={form.nationality} onChange={e => update('nationality', e.target.value.toUpperCase())} maxLength={3} placeholder="e.g. SUI" />
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.federation')}</label>
                  <input className={inputCls} value={form.federation} onChange={e => update('federation', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.email')}</label>
                  <input type="email" className={inputCls} value={form.email} onChange={e => update('email', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.phone')}</label>
                  <input type="tel" className={inputCls} value={form.phone} onChange={e => update('phone', e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="eap" checked={form.isEap} onChange={e => update('isEap', e.target.checked)} />
                <label htmlFor="eap" className="text-sm">{t('athlete.eapMember')}</label>
              </div>
              {form.nationality === 'SUI' && (
                <div>
                  <label className={labelCls}>{t('athlete.swissLicence')}</label>
                  <input className={inputCls} value={form.swiLicence} onChange={e => update('swiLicence', e.target.value)} />
                </div>
              )}
            </>
          )}

          {step === 'competition' && (
            <>
              <h2 className="font-semibold text-sm mb-2">{t('athlete.event')}</h2>
              <div>
                <label className={labelCls}>{t('athlete.primaryEvent')} *</label>
                <select className={inputCls} value={form.eventId} onChange={e => update('eventId', e.target.value)}>
                  <option value="">—</option>
                  {events.filter(e => e.id !== 'all').map(e => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.personalBest')} *</label>
                  <input className={inputCls} value={form.personalBest} onChange={e => update('personalBest', e.target.value)} placeholder="e.g. 9.80 or 3:26.73" />
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.seasonBest')} *</label>
                  <input className={inputCls} value={form.seasonBest} onChange={e => update('seasonBest', e.target.value)} placeholder="e.g. 9.95 or 3:28.50" />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('athlete.worldRanking')}</label>
                <input type="number" className={inputCls} value={form.worldRanking} onChange={e => update('worldRanking', e.target.value)} min={1} />
              </div>
              <div>
                <label className={labelCls}>{t('athlete.waProfile')}</label>
                <input className={inputCls} value={form.waProfileUrl} onChange={e => update('waProfileUrl', e.target.value)} placeholder="https://worldathletics.org/athletes/..." />
              </div>
            </>
          )}

          {step === 'compliance' && (
            <>
              <h2 className="font-semibold text-sm mb-2">{t('compliance.title')}</h2>
              <div>
                <label className={labelCls}>{t('compliance.iRunClean')}</label>
                <select className={inputCls} value={form.iRunClean} onChange={e => update('iRunClean', e.target.value)}>
                  <option value="unknown">—</option>
                  <option value="yes">{t('common.yes')}</option>
                  <option value="no">{t('common.no')}</option>
                  <option value="in_progress">In progress</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('compliance.dopingFree')}</label>
                <select className={inputCls} value={form.dopingFree} onChange={e => update('dopingFree', e.target.value)}>
                  <option value="unknown">—</option>
                  <option value="yes">{t('common.yes')}</option>
                  <option value="no">{t('common.no')}</option>
                </select>
              </div>
            </>
          )}

          {step === 'travel' && (
            <>
              <h2 className="font-semibold text-sm mb-2">{t('logistics.title')}</h2>
              <div>
                <label className={labelCls}>{t('logistics.specialRequests')}</label>
                <textarea className={inputCls} rows={3} value={form.participantNotes} onChange={e => update('participantNotes', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>{t('logistics.additionalNotes')}</label>
                <textarea className={inputCls} rows={3} value={form.additionalNotes} onChange={e => update('additionalNotes', e.target.value)} />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-4">
          {stepIndex > 0 ? (
            <button
              onClick={() => setStep(STEPS[stepIndex - 1])}
              className="px-4 py-2 text-sm border rounded-md hover:bg-gray-100"
            >
              {t('common.back')}
            </button>
          ) : (
            <Link to="/signup" className="px-4 py-2 text-sm border rounded-md hover:bg-gray-100">
              {t('common.back')}
            </Link>
          )}

          {stepIndex < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(STEPS[stepIndex + 1])}
              disabled={!canNext()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next')}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canNext()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t('common.loading') : t('common.submit')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

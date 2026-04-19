import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '@web/lib/api'
import { LanguageSwitcher } from '@web/App'
import type { Event, EapCity, Country } from '@shared/types'

// The events API returns Event joined with catalog data (name, discipline, gender, perfType)
interface EventWithCatalog extends Event {
  name: string
  discipline: string
  gender: string
  perfType: string
}

const STEPS = ['athlete', 'competition', 'compliance', 'travel'] as const
type Step = (typeof STEPS)[number]

export default function AthleteRegisterPage() {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('athlete')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string } | null>(null)

  // Form state
  const [form, setForm] = useState({
    firstName: '', lastName: '', gender: '' as 'M' | 'F' | '',
    dateOfBirth: '', phone: '', email: '', nationality: '',
    federation: '', isEap: false, eapCity: '', swiLicence: '',
    // Competition
    eventIds: [] as string[],
    waProfileUrl: '',
    // Compliance
    iRunClean: false,
    dopingFree: false,
    // Travel
    participantNotes: '', additionalNotes: '',
  })

  const { data: eapCities = [] } = useQuery<EapCity[]>({
    queryKey: ['eap-cities'],
    queryFn: () => api.get('/api/v1/eap-cities'),
    enabled: form.isEap,
  })

  const { data: countries = [] } = useQuery<Country[]>({
    queryKey: ['countries'],
    queryFn: () => api.get('/api/v1/countries'),
  })

  // Fetch events filtered by gender
  const { data: events = [] } = useQuery<EventWithCatalog[]>({
    queryKey: ['events', form.gender],
    queryFn: () => api.get(`/api/v1/events${form.gender ? `?gender=${form.gender}` : ''}`),
    enabled: true,
  })

  const update = (field: string, value: string | boolean | string[]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const toggleEvent = (eventId: string) => {
    setForm(prev => ({
      ...prev,
      eventIds: prev.eventIds.includes(eventId)
        ? prev.eventIds.filter(id => id !== eventId)
        : [...prev.eventIds, eventId],
    }))
  }

  const stepIndex = STEPS.indexOf(step)
  const canNext = () => {
    if (step === 'athlete') return form.firstName && form.lastName && form.gender && form.nationality && form.email
    if (step === 'competition') return form.eventIds.length > 0
    return true
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const result = await api.post('/api/v1/athletes', {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth || undefined,
        nationality: form.nationality,
        federation: form.federation || undefined,
        isEap: form.isEap,
        eapCity: form.eapCity || undefined,
        isSwiss: form.nationality === 'SUI',
        swiLicence: form.swiLicence || undefined,
        athleteEmail: form.email,
        athletePhone: form.phone || undefined,
        eventIds: form.eventIds,
        waProfileUrl: form.waProfileUrl || undefined,
        iRunClean: form.iRunClean,
        dopingFree: form.dopingFree,
        participantNotes: form.participantNotes || undefined,
        additionalNotes: form.additionalNotes || undefined,
      }) as { emailPreview?: { subject: string; body: string } | null }
      if (result.emailPreview) {
        setEmailPreview(result.emailPreview)
      } else {
        setSubmitted(true)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (emailPreview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-lg">
          <h1 className="text-xl font-bold mb-4 text-center">Atletica Genève</h1>
          <div className="bg-white rounded-lg border p-6">
            <h2 className="font-bold text-sm mb-1">{t('emailPreview.title')}</h2>
            <p className="text-xs text-gray-500 mb-4">{t('emailPreview.description')}</p>
            <div className="bg-gray-50 rounded border p-4 text-xs space-y-3 mb-6">
              <div>
                <span className="font-semibold text-gray-600">{t('emailPreview.subject')} :</span>{' '}
                <span>{emailPreview.subject}</span>
              </div>
              <hr />
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{emailPreview.body}</pre>
            </div>
            <button
              onClick={() => { setEmailPreview(null); setSubmitted(true) }}
              className="w-full px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold mb-2">Atletica Genève</h1>
          <div className="bg-white rounded-lg border p-6">
            <div className="text-3xl mb-3">&#10003;</div>
            <p className="font-semibold text-sm mb-1">{t('athlete.registration')} — {form.firstName} {form.lastName}</p>
            <p className="text-xs text-gray-500 mb-2">{t('athlete.applicationSubmitted')}</p>
            <p className="text-xs text-blue-600">
              {t('athlete.loginLinkSent', { email: form.email })}
            </p>
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
              <div>
                <label className={labelCls}>{t('athlete.email')} *</label>
                <input type="email" className={inputCls} value={form.email} onChange={e => update('email', e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.gender')} *</label>
                  <div className="flex gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="gender" value="M" checked={form.gender === 'M'}
                        onChange={() => { update('gender', 'M'); update('eventIds', []) }}
                        className="accent-gray-900" />
                      <span className="text-sm">{t('athlete.male')}</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="gender" value="F" checked={form.gender === 'F'}
                        onChange={() => { update('gender', 'F'); update('eventIds', []) }}
                        className="accent-gray-900" />
                      <span className="text-sm">{t('athlete.female')}</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.dateOfBirth')}</label>
                  <input type="date" className={inputCls} value={form.dateOfBirth} onChange={e => update('dateOfBirth', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{t('athlete.nationality')} *</label>
                  <input className={inputCls} list="nat-list" value={form.nationality} onChange={e => update('nationality', e.target.value.toUpperCase())} maxLength={3} placeholder="e.g. SUI" />
                  <datalist id="nat-list">
                    {countries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls}>{t('athlete.phone')}</label>
                  <input type="tel" className={inputCls} value={form.phone} onChange={e => update('phone', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t('athlete.federation')}</label>
                <input className={inputCls} value={form.federation} onChange={e => update('federation', e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="eap" checked={form.isEap} onChange={e => { update('isEap', e.target.checked); if (!e.target.checked) update('eapCity', '') }} />
                <label htmlFor="eap" className="text-sm">{t('athlete.eapMember')}</label>
              </div>
              {form.isEap && (
                <div>
                  <label className={labelCls}>{t('athlete.eapCity')}</label>
                  <select className={inputCls} value={form.eapCity} onChange={e => update('eapCity', e.target.value)}>
                    <option value="">--</option>
                    {eapCities.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.countryCode})</option>
                    ))}
                  </select>
                </div>
              )}
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
              <h2 className="font-semibold text-sm mb-2">{t('athlete.waProfile')}</h2>
              <div>
                <label className={labelCls}>{t('athlete.waProfile')} *</label>
                <input className={inputCls} value={form.waProfileUrl} onChange={e => update('waProfileUrl', e.target.value)} placeholder="https://worldathletics.org/athletes/..." />
              </div>
              <h2 className="font-semibold text-sm mt-4 mb-2">{t('athlete.event')}(s) *</h2>
              {!form.gender ? (
                <p className="text-xs text-gray-400">{t('athlete.selectGenderFirst')}</p>
              ) : (
                <div className="space-y-2">
                  {events.map(e => (
                    <label key={e.id} className="flex items-center gap-3 p-2 rounded border cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.eventIds.includes(e.id)}
                        onChange={() => toggleEvent(e.id)}
                        className="accent-gray-900"
                      />
                      <span className="text-sm">{e.name}</span>
                    </label>
                  ))}
                  {events.length === 0 && (
                    <p className="text-xs text-gray-400">{t('athlete.noEventsForGender')}</p>
                  )}
                </div>
              )}
            </>
          )}

          {step === 'compliance' && (
            <>
              <h2 className="font-semibold text-sm mb-2">{t('compliance.title')}</h2>
              <label className="flex items-center gap-3 p-3 rounded border cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.iRunClean} onChange={e => update('iRunClean', e.target.checked)} className="accent-gray-900" />
                <span className="text-sm">{t('compliance.iRunClean')}</span>
              </label>
              <label className="flex items-center gap-3 p-3 rounded border cursor-pointer hover:bg-gray-50">
                <input type="checkbox" checked={form.dopingFree} onChange={e => update('dopingFree', e.target.checked)} className="accent-gray-900" />
                <span className="text-sm">{t('compliance.dopingFree')}</span>
              </label>
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

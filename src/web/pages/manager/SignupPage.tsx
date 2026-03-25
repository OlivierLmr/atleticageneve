import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@web/lib/api'
import { LanguageSwitcher } from '@web/App'

export default function ManagerSignupPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', organization: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  const canSubmit = form.firstName && form.lastName && form.email && form.phone

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post<{ token: string; user: { id: string } }>('/api/v1/managers/register', {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        organization: form.organization || undefined,
      })
      if (res.token) {
        localStorage.setItem('session_token', res.token)
      }
      navigate('/manager/register')
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent'
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Atletica Genève</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-gray-500 mb-6">{t('manager.registration')}</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
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
            <label className={labelCls}>{t('manager.agency')}</label>
            <input className={inputCls} value={form.organization} onChange={e => update('organization', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>{t('auth.email')} *</label>
            <input type="email" className={inputCls} value={form.email} onChange={e => update('email', e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>{t('athlete.phone')} *</label>
            <input type="tel" className={inputCls} value={form.phone} onChange={e => update('phone', e.target.value)} required />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('common.loading') : t('common.next')}
          </button>
        </form>

        <p className="text-center mt-4">
          <Link to="/signup" className="text-xs text-gray-400 underline">{t('common.back')}</Link>
        </p>
      </div>
    </div>
  )
}

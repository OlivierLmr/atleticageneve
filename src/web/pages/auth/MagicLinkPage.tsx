import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '@web/lib/auth'

/**
 * Magic link login page for athletes and managers.
 */
export default function MagicLinkPage() {
  const { t } = useTranslation()
  const { requestMagicLink } = useAuth()

  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await requestMagicLink(email)
      setSent(true)
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-bold mb-1">Atletica Genève</h1>
          <div className="bg-white rounded-lg border p-6 mt-6">
            <div className="text-3xl mb-3">✉️</div>
            <p className="text-sm text-gray-700">{t('auth.magicLinkSent')}</p>
            <p className="text-xs text-gray-400 mt-2">{email}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-center mb-1">Atletica Genève</h1>
        <p className="text-sm text-gray-500 text-center mb-8">{t('auth.magicLinkPrompt')}</p>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoComplete="email"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          <Link to="/" className="underline hover:text-gray-600">{t('common.back')}</Link>
        </p>
      </div>
    </div>
  )
}

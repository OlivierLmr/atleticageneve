import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@web/lib/auth'

/**
 * Handles the magic link verification when the user clicks the emailed link.
 */
export default function VerifyMagicLinkPage() {
  const { t } = useTranslation()
  const { verifyMagicLink } = useAuth()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('No token provided')
      return
    }

    verifyMagicLink(token)
      .then(() => {
        // Redirect based on user role — for now, go to home
        navigate('/')
      })
      .catch(() => {
        setError(t('auth.sessionExpired'))
      })
  }, [searchParams, verifyMagicLink, navigate, t])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-bold mb-4">Atletica Genève</h1>
        {error ? (
          <div className="bg-white rounded-lg border p-6">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        )}
      </div>
    </div>
  )
}

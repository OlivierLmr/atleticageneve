import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@web/lib/auth'
import LoginPage from '@web/pages/auth/LoginPage'
import MagicLinkPage from '@web/pages/auth/MagicLinkPage'
import VerifyMagicLinkPage from '@web/pages/auth/VerifyMagicLinkPage'
import SignupPage from '@web/pages/signup/SignupPage'
import AthleteRegisterPage from '@web/pages/athlete/RegisterPage'
import AthletePortalPage from '@web/pages/athlete/PortalPage'
import ManagerSignupPage from '@web/pages/manager/SignupPage'
import ManagerRegisterPage from '@web/pages/manager/RegisterPage'
import ManagerPortalPage from '@web/pages/manager/PortalPage'
import CandidatesPage from '@web/pages/collaborator/CandidatesPage'
import CollaboratorAthletePage from '@web/pages/collaborator/AthletePage'
import DashboardPage from '@web/pages/committee/DashboardPage'
import { api } from '@web/lib/api'
import type { ReactNode } from 'react'
import type { UserRole } from '@shared/types'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

// ── Language switcher ─────────────────────────────────────────────────────────

export function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const toggle = () => {
    const next = i18n.language === 'fr' ? 'en' : 'fr'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }
  return (
    <button
      onClick={toggle}
      className="text-sm font-medium px-2 py-1 rounded border border-gray-300 hover:bg-gray-100"
    >
      {i18n.language === 'fr' ? 'EN' : 'FR'}
    </button>
  )
}

// ── Protected route wrapper ───────────────────────────────────────────────────

function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: UserRole[] }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ── Home page ─────────────────────────────────────────────────────────────────

interface DevEmail {
  to: string
  subject: string
  body: string
  lang: string
  sentAt: string
}

function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'identifier' | 'password' | 'magic_link_sent'>('identifier')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: emails = [] } = useQuery<DevEmail[]>({
    queryKey: ['dev-emails'],
    queryFn: () => api.get('/api/v1/dev/emails'),
    refetchInterval: 5000,
  })

  // If already logged in, redirect to the right portal
  if (user && !loading) {
    const dest: Record<string, string> = {
      athlete: '/athlete/portal',
      manager: '/manager/portal',
      collaborator: '/collaborator/candidates',
      committee: '/committee/dashboard',
    }
    return <Navigate to={dest[user.role] ?? '/'} replace />
  }

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ method: 'password' | 'magic_link' | 'not_found' }>(
        '/api/v1/auth/identify',
        { identifier: identifier.trim() },
      )
      if (res.method === 'password') {
        setStep('password')
      } else if (res.method === 'not_found') {
        setError(t('auth.notRegistered'))
      } else {
        setStep('magic_link_sent')
      }
    } catch {
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ token: string; user: { id: string; role: string; firstName: string; lastName: string; email: string | null; preferredLang: 'en' | 'fr' } }>(
        '/api/v1/auth/login-with-password',
        { identifier: identifier.trim(), password },
      )
      localStorage.setItem('session_token', res.token)
      // Trigger auth context refresh by navigating
      window.location.href = res.user.role === 'committee' ? '/committee/dashboard' : '/collaborator/candidates'
    } catch {
      setError(t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('identifier')
    setPassword('')
    setError('')
  }

  return (
    <div className="max-w-sm mx-auto mt-20 px-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Atletica Genève</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-gray-500 text-sm mb-8">{t('signup.subtitle')}</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {step === 'identifier' && (
          <form onSubmit={handleIdentify}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.enterEmailOrUsername')}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              placeholder="email@example.com"
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? t('common.loading') : t('auth.continue')}
            </button>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={handlePasswordLogin}>
            <p className="text-sm text-gray-500 mb-3">{identifier}</p>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.enterPassword')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 mb-2"
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>
            <button
              type="button"
              onClick={handleBack}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              {t('common.back')}
            </button>
          </form>
        )}

        {step === 'magic_link_sent' && (
          <div>
            <p className="text-sm text-gray-700 mb-4">{t('auth.magicLinkSent')}</p>
            <button
              type="button"
              onClick={handleBack}
              className="w-full text-sm text-gray-500 hover:text-gray-700 py-1"
            >
              {t('common.back')}
            </button>
          </div>
        )}
      </div>

      <Link
        to="/signup"
        className="block w-full text-center px-3 py-2.5 rounded-md border border-gray-200 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
      >
        {t('auth.registerAsAthleteOrManager')}
      </Link>

      {/* DEV ONLY — email log */}
      {emails.length > 0 && (
        <div className="mt-8 mb-12">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-2">
            Dev — Emails sent (last hour)
          </p>
          <div className="flex flex-col gap-2">
            {emails.slice().reverse().map((email, i) => (
              <div key={i} className="border border-orange-200 bg-orange-50 rounded-md px-3 py-2">
                <div className="flex justify-between text-[10px] text-orange-400 mb-1">
                  <span>To: {email.to}</span>
                  <span>{new Date(email.sentAt).toLocaleTimeString()}</span>
                </div>
                <p className="text-xs font-medium text-gray-900 mb-1">{email.subject}</p>
                <pre className="text-[10px] text-gray-600 whitespace-pre-wrap font-mono">{email.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />

            {/* Auth */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/magic-link" element={<MagicLinkPage />} />
            <Route path="/auth/verify" element={<VerifyMagicLinkPage />} />

            {/* Signup & Registration — public */}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/athlete/register" element={<AthleteRegisterPage />} />
            <Route path="/manager/signup" element={<ManagerSignupPage />} />
            <Route path="/manager/register" element={<ManagerRegisterPage />} />

            {/* Athlete — requires athlete or manager role */}
            <Route path="/athlete/portal" element={
              <ProtectedRoute roles={['athlete', 'manager']}>
                <AthletePortalPage />
              </ProtectedRoute>
            } />

            {/* Manager — requires manager role */}
            <Route path="/manager/portal" element={
              <ProtectedRoute roles={['manager']}>
                <ManagerPortalPage />
              </ProtectedRoute>
            } />

            {/* Collaborator — requires collaborator role */}
            <Route path="/collaborator/candidates" element={
              <ProtectedRoute roles={['collaborator', 'committee']}>
                <CandidatesPage />
              </ProtectedRoute>
            } />
            <Route path="/collaborator/athletes/:id" element={
              <ProtectedRoute roles={['collaborator', 'committee']}>
                <CollaboratorAthletePage />
              </ProtectedRoute>
            } />

            {/* Committee — requires committee role */}
            <Route path="/committee/dashboard" element={
              <ProtectedRoute roles={['committee']}>
                <DashboardPage />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

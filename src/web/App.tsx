import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@web/lib/auth'
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
import EditionConfigPage from '@web/pages/committee/EditionConfigPage'
import EventCatalogPage from '@web/pages/committee/EventCatalogPage'
import CountriesPage from '@web/pages/committee/CountriesPage'
import EapCitiesPage from '@web/pages/committee/EapCitiesPage'
import HotelRoomsPage from '@web/pages/committee/HotelRoomsPage'
import EmailLogPage from '@web/pages/committee/EmailLogPage'
import EventsPage from '@web/pages/committee/EventsPage'
import PaymentsPage from '@web/pages/committee/PaymentsPage'
import ResultsPage from '@web/pages/committee/ResultsPage'
import { api, ApiError } from '@web/lib/api'
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
  const { t } = useTranslation()

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">{t('common.loading')}</div>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ── Shared staff layout with navigation ──────────────────────────────────────

interface NavItem {
  to: string
  key: string
  activePrefix?: string  // also highlight when pathname starts with this
}

const COMMITTEE_NAV: NavItem[] = [
  { to: '/committee/dashboard', key: 'nav.dashboard' },
  { to: '/committee/edition-config', key: 'nav.edition' },
  { to: '/committee/events', key: 'nav.events' },
  { to: '/committee/event-catalog', key: 'nav.eventCatalog' },
  { to: '/committee/countries', key: 'nav.countries' },
  { to: '/committee/eap-cities', key: 'nav.eapCities' },
  { to: '/committee/hotel-rooms', key: 'nav.hotelRooms' },
  { to: '/committee/emails', key: 'nav.emailLog' },
  { to: '/committee/candidates', key: 'nav.candidates', activePrefix: '/committee/athletes/' },
  { to: '/committee/results', key: 'nav.results' },
  { to: '/committee/payments', key: 'nav.payments' },
]

const COLLABORATOR_NAV: NavItem[] = [
  { to: '/collaborator/candidates', key: 'nav.candidates' },
]

function AppLayout({ navItems }: { navItems: NavItem[] }) {
  const { user, logout } = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-12">
          <div className="flex items-center gap-1 overflow-x-auto">
            {navItems.map(({ to, key, activePrefix }) => {
              const active = location.pathname === to || (activePrefix != null && location.pathname.startsWith(activePrefix))
              return (
                <Link
                  key={to}
                  to={to}
                  className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap ${
                    active
                      ? 'bg-gray-900 text-white font-medium'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {t(key)}
                </Link>
              )
            })}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
              </span>
            )}
            <LanguageSwitcher />
            <button
              onClick={() => logout()}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('auth.logout')}
            </button>
          </div>
        </div>
      </nav>
      <Outlet />
    </div>
  )
}

// ── Home page ─────────────────────────────────────────────────────────────────

function HomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [mode, setMode] = useState<'choose' | 'admin' | 'athlete' | 'admin_password' | 'magic_link_sent'>('choose')
  const [identifier, setIdentifier] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailPreview, setEmailPreview] = useState<{ subject: string; body: string; htmlBody?: string } | null>(null)

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

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ token: string; user: { id: string; role: string } }>(
        '/api/v1/auth/login-with-password',
        { identifier: identifier.trim(), password },
      )
      localStorage.setItem('session_token', res.token)
      window.location.href = res.user.role === 'committee' ? '/committee/dashboard' : '/collaborator/candidates'
    } catch (err) {
      setError(err instanceof ApiError && err.status !== 401 ? err.message : t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ method: string; emailPreview?: { subject: string; body: string; htmlBody?: string } }>(
        '/api/v1/auth/identify',
        { identifier: email.trim() },
      )
      if (res.method === 'not_found') {
        setError(t('auth.notRegistered'))
      } else {
        setMode('magic_link_sent')
        if (res.emailPreview) setEmailPreview(res.emailPreview)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setMode('choose')
    setIdentifier('')
    setEmail('')
    setPassword('')
    setError('')
    setEmailPreview(null)
  }

  return (
    <div className="max-w-sm mx-auto mt-20 px-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Atletica Genève</h1>
        <LanguageSwitcher />
      </div>
      <p className="text-gray-500 text-sm mb-8">{t('signup.subtitle')}</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        {/* Step 1: Choose role */}
        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('athlete')}
              className="w-full px-3 py-3 rounded-md border border-gray-200 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="font-medium">{t('home.iAmAthleteManager')}</span>
            </button>
            <button
              onClick={() => setMode('admin')}
              className="w-full px-3 py-3 rounded-md border border-gray-200 text-sm text-gray-900 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="font-medium">{t('home.iAmAdmin')}</span>
            </button>
          </div>
        )}

        {/* Admin: username + password */}
        {mode === 'admin' && (
          <form onSubmit={handleAdminLogin}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.username')}
            </label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              autoFocus
            />
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 mb-2"
            >
              {loading ? t('common.loading') : t('auth.login')}
            </button>
            <button type="button" onClick={handleBack} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
              {t('common.back')}
            </button>
          </form>
        )}

        {/* Athlete/Manager: email for magic link */}
        {mode === 'athlete' && (
          <div>
            <p className="text-sm text-gray-500 mb-4">{t('home.magicLinkExplainer')}</p>
            <form onSubmit={handleMagicLink}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('auth.email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="email@example.com"
                autoFocus
              />
              {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gray-900 text-white text-sm font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50 mb-3"
              >
                {loading ? t('common.loading') : t('home.sendLoginLink')}
              </button>
            </form>
            <div className="border-t border-gray-100 pt-3">
              <Link
                to="/signup"
                className="block w-full text-center text-sm text-gray-900 font-medium hover:underline"
              >
                {t('auth.registerAsAthleteOrManager')}
              </Link>
            </div>
            <button type="button" onClick={handleBack} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1 mt-2">
              {t('common.back')}
            </button>
          </div>
        )}

        {/* Magic link sent confirmation */}
        {mode === 'magic_link_sent' && (
          <div>
            <p className="text-sm text-gray-700 mb-4">{t('auth.magicLinkSent')}</p>
            <button type="button" onClick={handleBack} className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
              {t('common.back')}
            </button>
          </div>
        )}
      </div>

      {emailPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="w-full max-w-lg bg-white rounded-lg border shadow-xl p-6">
            <h2 className="font-bold text-sm mb-1">{t('emailPreview.title')}</h2>
            <p className="text-xs text-gray-500 mb-4">{t('emailPreview.description')}</p>
            <div className="bg-gray-50 rounded border p-4 text-xs space-y-3 mb-6">
              <div>
                <span className="font-semibold text-gray-600">{t('emailPreview.subject')} :</span>{' '}
                <span>{emailPreview.subject}</span>
              </div>
              <hr />
              {emailPreview.htmlBody ? (
                <div className="text-sm prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: emailPreview.htmlBody }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans leading-relaxed">{emailPreview.body}</pre>
              )}
            </div>
            <button
              onClick={() => setEmailPreview(null)}
              className="w-full px-4 py-2 text-sm bg-gray-900 text-white rounded-md hover:bg-gray-800"
            >
              {t('common.close')}
            </button>
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
            <Route path="/athlete/athletes/:id" element={
              <ProtectedRoute roles={['athlete', 'manager']}>
                <CollaboratorAthletePage />
              </ProtectedRoute>
            } />

            {/* Manager — requires manager role */}
            <Route path="/manager/portal" element={
              <ProtectedRoute roles={['manager']}>
                <ManagerPortalPage />
              </ProtectedRoute>
            } />
            <Route path="/manager/athletes/:id" element={
              <ProtectedRoute roles={['manager']}>
                <CollaboratorAthletePage />
              </ProtectedRoute>
            } />

            {/* Collaborator — requires collaborator role */}
            <Route path="/collaborator" element={
              <ProtectedRoute roles={['collaborator']}>
                <AppLayout navItems={COLLABORATOR_NAV} />
              </ProtectedRoute>
            }>
              <Route path="candidates" element={<CandidatesPage />} />
              <Route path="athletes/:id" element={<CollaboratorAthletePage />} />
            </Route>

            {/* Committee — requires committee role (uses CommitteeLayout with nav) */}
            <Route path="/committee" element={
              <ProtectedRoute roles={['committee']}>
                <AppLayout navItems={COMMITTEE_NAV} />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="edition-config" element={<EditionConfigPage />} />
              <Route path="events" element={<EventsPage />} />
              <Route path="event-catalog" element={<EventCatalogPage />} />
              <Route path="countries" element={<CountriesPage />} />
              <Route path="eap-cities" element={<EapCitiesPage />} />
              <Route path="hotel-rooms" element={<HotelRoomsPage />} />
              <Route path="emails" element={<EmailLogPage />} />
              <Route path="candidates" element={<CandidatesPage />} />
              <Route path="athletes/:id" element={<CollaboratorAthletePage />} />
              <Route path="results" element={<ResultsPage />} />
              <Route path="payments" element={<PaymentsPage />} />
            </Route>

            {/* Redirects for committee users hitting collaborator paths */}
            <Route path="/collaborator/candidates" element={
              <ProtectedRoute roles={['committee']}>
                <Navigate to="/committee/candidates" replace />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

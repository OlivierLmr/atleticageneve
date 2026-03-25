import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
    return <Navigate to="/auth/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ── Home page ─────────────────────────────────────────────────────────────────

function HomePage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const routes = [
    {
      group: t('signup.title'),
      links: [{ label: t('nav.signup'), path: '/signup' }],
    },
    {
      group: t('nav.athletePortal'),
      links: [
        { label: t('nav.athletePortal'), path: '/athlete/portal' },
        { label: `${t('auth.login')} (${t('auth.magicLinkPrompt')})`, path: '/auth/magic-link' },
      ],
    },
    {
      group: t('nav.managerPortal'),
      links: [{ label: t('nav.managerPortal'), path: '/manager/portal' }],
    },
    {
      group: t('nav.selectionConsole'),
      links: [
        { label: t('nav.selectionConsole'), path: '/collaborator/candidates' },
        { label: `${t('auth.login')} (${t('auth.username')}/${t('auth.password')})`, path: '/auth/login' },
      ],
    },
    {
      group: t('nav.dashboard'),
      links: [{ label: t('nav.dashboard'), path: '/committee/dashboard' }],
    },
  ]

  return (
    <div className="max-w-md mx-auto mt-20 px-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-bold">Atletica Genève</h1>
        <div className="flex items-center gap-2">
          {user && (
            <button
              onClick={() => logout()}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              {t('auth.logout')} ({user.firstName})
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </div>
      <p className="text-gray-500 text-sm mb-8">{t('signup.subtitle')}</p>
      {routes.map(({ group, links }) => (
        <div key={group} className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
            {group}
          </p>
          <div className="flex flex-col gap-1">
            {links.map(({ label, path }) => (
              <Link
                key={path}
                to={path}
                className="block px-3 py-2.5 rounded-md border border-gray-200 text-sm text-gray-900 hover:bg-gray-50 transition-colors"
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
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

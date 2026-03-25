import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
})

function LanguageSwitcher() {
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

function HomePage() {
  const { t } = useTranslation()

  const routes = [
    {
      group: t('signup.title'),
      links: [{ label: t('nav.signup'), path: '/signup' }],
    },
    {
      group: t('nav.athletePortal'),
      links: [{ label: t('nav.athletePortal'), path: '/athlete/portal' }],
    },
    {
      group: t('nav.managerPortal'),
      links: [{ label: t('nav.managerPortal'), path: '/manager/portal' }],
    },
    {
      group: t('nav.selectionConsole'),
      links: [{ label: t('nav.selectionConsole'), path: '/collaborator/candidates' }],
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
        <LanguageSwitcher />
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* Portal routes will be added in subsequent phases */}
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

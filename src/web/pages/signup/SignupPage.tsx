import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '@web/App'

export default function SignupPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold">Atletica Genève</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-gray-500 mb-8">{t('signup.subtitle')}</p>

        <div className="space-y-3">
          <Link
            to="/athlete/register"
            className="block bg-white rounded-lg border p-5 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-sm mb-1">{t('signup.iAmAthlete')}</h2>
            <p className="text-xs text-gray-500">{t('signup.athleteDesc')}</p>
          </Link>

          <Link
            to="/manager/signup"
            className="block bg-white rounded-lg border p-5 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-sm mb-1">{t('signup.iAmManager')}</h2>
            <p className="text-xs text-gray-500">{t('signup.managerDesc')}</p>
          </Link>
        </div>

        <p className="text-center mt-6">
          <Link to="/" className="text-xs text-gray-400 underline">{t('common.back')}</Link>
        </p>
      </div>
    </div>
  )
}

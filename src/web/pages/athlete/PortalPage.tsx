import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import { LanguageSwitcher } from '@web/App'
import { STATUS_COLORS, formatPerf } from '@web/lib/ui-constants'
import type { Application, Athlete, Event, WaPerformance } from '@shared/types'

interface PortalEvent extends Event {
  name: string
  discipline: string
  gender: string
}

interface PortalApplication extends Application {
  event: PortalEvent | null
  waPerformance: WaPerformance | null
}

interface PortalAthlete extends Athlete {
  applications: PortalApplication[]
}

export default function AthletePortalPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()

  const { data, isLoading } = useQuery<{ athletes: PortalAthlete[] }>({
    queryKey: ['athlete-portal'],
    queryFn: () => api.get('/api/v1/portal/athlete'),
  })

  const athletes = data?.athletes ?? []

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold">Atletica Genève</Link>
            <span className="text-xs text-gray-400">{t('athlete.portal')}</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-xs text-gray-400">
                {user.firstName} {user.lastName}
              </span>
            )}
            {user && (
              <button onClick={() => logout()} className="text-xs text-gray-400 hover:text-gray-600">
                {t('auth.logout')}
              </button>
            )}
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {athletes.length === 0 ? (
          <div className="bg-white rounded-lg border p-8 text-center">
            <p className="text-gray-400 text-sm mb-4">{t('athlete.noApplications')}</p>
            <Link to="/athlete/register" className="text-sm text-blue-600 underline">
              {t('athlete.registerForEvent')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {athletes.map((ath) => (
              <Link
                key={ath.id}
                to={`/athlete/athletes/${ath.id}`}
                className="block bg-white rounded-lg border p-4 hover:border-gray-400 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="font-semibold">{ath.firstName} {ath.lastName}</h2>
                    <p className="text-xs text-gray-400">{ath.nationality} · {ath.gender === 'M' ? t('athlete.male') : t('athlete.female')}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[ath.negotiationStatus]}`}>
                    {t(`status.${ath.negotiationStatus}`)}
                  </span>
                </div>
                {ath.applications.length > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {ath.applications.map(app => (
                      <span key={app.id} className="flex items-center gap-1">
                        <span className="font-medium text-gray-700">{app.event?.name ?? '—'}</span>
                        {app.waPerformance?.seasonBest != null && (
                          <span className="text-gray-400">SB: {formatPerf(app.waPerformance.seasonBest)}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

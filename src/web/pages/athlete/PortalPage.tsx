import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@web/lib/api'

export default function AthletePortalPage() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery<{ athletes: { id: string }[] }>({
    queryKey: ['athlete-portal'],
    queryFn: () => api.get('/api/v1/portal/athlete'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  const athletes = data?.athletes ?? []

  if (athletes.length === 0) {
    return <Navigate to="/athlete/register" replace />
  }

  return <Navigate to={`/athlete/athletes/${athletes[0].id}`} replace />
}

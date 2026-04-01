import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { EmailLog } from '@shared/types'

export default function EmailLogPage() {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: emails = [], isLoading } = useQuery<EmailLog[]>({
    queryKey: ['emails'],
    queryFn: () => api.get('/api/v1/emails?limit=200'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-lg font-bold mb-6">{t('admin.emailLog')}</h1>

      {emails.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center text-gray-400 text-sm">
          {t('common.none')}
        </div>
      ) : (
        <div className="bg-white rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-3 py-2 text-left font-medium">{t('admin.sentAt')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('admin.emailTo')}</th>
                <th className="px-3 py-2 text-left font-medium">{t('admin.subject')}</th>
                <th className="px-3 py-2 text-left font-medium w-10">{t('admin.lang')}</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <>
                  <tr
                    key={email.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === email.id ? null : email.id)}
                  >
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(email.sentAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{email.to}</td>
                    <td className="px-3 py-2">{email.subject}</td>
                    <td className="px-3 py-2 text-xs text-gray-400">{email.lang}</td>
                  </tr>
                  {expandedId === email.id && (
                    <tr key={`${email.id}-body`} className="border-b bg-gray-50/50">
                      <td colSpan={4} className="px-4 py-3">
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{email.body}</pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

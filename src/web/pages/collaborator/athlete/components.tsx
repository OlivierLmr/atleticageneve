import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatAgreementTerms } from '@shared/agreementFormatter'
import { inputCls } from '@web/lib/ui-constants'
import type { Athlete, Agreement, Interaction } from '@shared/types'
import type { FieldDef } from './types'

// ── CollapsibleSection ──────────────────────────────────────────────────────

export function CollapsibleSection({ title, isOpen, onToggle, canEdit, isEditing, onToggleEdit, children }: {
  title: string; isOpen: boolean; onToggle: () => void
  canEdit?: boolean; isEditing?: boolean; onToggleEdit?: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-lg border">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-3 text-sm font-semibold hover:bg-gray-50">
        <span>{title}</span>
        <span className="flex items-center gap-2">
          {canEdit && isOpen && (
            <span
              onClick={e => { e.stopPropagation(); onToggleEdit?.() }}
              className={`text-xs cursor-pointer px-1.5 py-0.5 rounded ${isEditing ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-gray-600'}`}
              title={isEditing ? t('common.cancelEdit') : t('common.edit')}
            >
              ✎
            </span>
          )}
          <span className="text-gray-400 text-xs">{isOpen ? '▾' : '▸'}</span>
        </span>
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ── FieldReadOnly ───────────────────────────────────────────────────────────

export function FieldReadOnly({ athlete, fields, t }: {
  athlete: Athlete; fields: FieldDef[]; t: (key: string) => string
}) {
  return (
    <div className="space-y-1.5">
      {fields.map(f => {
        const raw = (athlete as unknown as Record<string, unknown>)[f.key]
        let display: string
        if (f.type === 'checkbox') {
          display = raw ? t('common.yes') : t('common.no')
        } else if (f.type === 'select') {
          display = f.options?.find(o => o.value === raw)?.label ?? String(raw ?? '—')
        } else {
          display = raw != null && raw !== '' && raw !== 0 ? String(raw) : '—'
        }
        return (
          <div key={f.key} className="flex justify-between text-xs">
            <span className="text-gray-500">{f.label}</span>
            <span className="text-gray-900 font-medium text-right max-w-[60%] truncate">{display}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── AthleteFieldEditor ──────────────────────────────────────────────────────

export function AthleteFieldEditor({ athlete, fields, onSave, isPending, error, t }: {
  athlete: Athlete
  fields: FieldDef[]
  onSave: (data: Record<string, unknown>) => void
  isPending: boolean
  error: Error | null
  t: (key: string) => string
}) {
  const [form, setForm] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of fields) {
      init[f.key] = (athlete as unknown as Record<string, unknown>)[f.key] ?? (f.type === 'checkbox' ? false : f.type === 'number' ? 0 : '')
    }
    return init
  })

  return (
    <div className="space-y-2">
      {fields.map(f => (
        <div key={f.key}>
          {f.type === 'checkbox' ? (
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={form[f.key] as boolean}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.checked }))} />
              {f.label}
            </label>
          ) : f.type === 'select' ? (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <select className={inputCls} value={form[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </>
          ) : f.type === 'textarea' ? (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <textarea className={inputCls} rows={2} value={form[f.key] as string}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </>
          ) : (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <input type={f.type} className={inputCls} value={form[f.key] as string | number}
                onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? (parseInt(e.target.value) || 0) : e.target.value }))} />
            </>
          )}
        </div>
      ))}
      <button
        onClick={() => onSave(form)}
        disabled={isPending}
        className="mt-2 text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
      {error && <p className="text-xs text-red-600">{error.message || t('common.error')}</p>}
    </div>
  )
}

// ── SelectorAssign ──────────────────────────────────────────────────────────

export function SelectorAssign({ currentValue, staffUsers, onSave, isPending, t }: {
  currentValue: string | null
  staffUsers: { id: string; firstName: string; lastName: string }[]
  onSave: (val: string) => void
  isPending: boolean
  t: (key: string) => string
}) {
  const [value, setValue] = useState(currentValue ?? '')
  return (
    <div className="space-y-2">
      <select
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
        value={value}
        onChange={e => setValue(e.target.value)}
      >
        <option value="">— {t('common.unassigned')} —</option>
        {staffUsers.map(u => (
          <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
        ))}
      </select>
      <button
        onClick={() => onSave(value)}
        disabled={isPending}
        className="text-xs bg-gray-900 text-white px-3 py-1 rounded hover:bg-gray-800 disabled:opacity-50"
      >
        {t('common.save')}
      </button>
    </div>
  )
}

// ── AgreementCard ───────────────────────────────────────────────────────────

export function AgreementCard({
  agreement: c,
  selectedEventNames,
  meetingName,
  lang,
  isStaff,
  t,
}: {
  agreement: Agreement
  selectedEventNames: string[]
  meetingName: string
  lang: string
  isStaff: boolean
  t: (key: string) => string
}) {
  const formattedLang = (lang === 'fr' ? 'fr' : 'en') as 'en' | 'fr'
  const formattedText = formatAgreementTerms(c, selectedEventNames, meetingName, formattedLang)

  return (
    <div className="p-3 rounded border border-blue-200 bg-blue-50 text-xs">
      <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed">{formattedText}</pre>
      {isStaff && c.totalCost > 0 && (
        <div className="mt-2 pt-2 border-t border-blue-200 font-semibold text-gray-900">
          {t('contract.totalCost')}: CHF {c.totalCost.toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ── CounterOfferCard ────────────────────────────────────────────────────────

export function CounterOfferCard({ interaction }: { interaction: Interaction }) {
  return (
    <div className="p-3 rounded border border-rose-200 bg-rose-50 text-xs">
      <div className="flex justify-between mb-1">
        <span className="font-semibold text-rose-700">{interaction.authorName}</span>
        <span className="text-gray-500">{new Date(interaction.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="text-gray-700 whitespace-pre-wrap">{interaction.content}</p>
    </div>
  )
}

// ── InteractionCard ─────────────────────────────────────────────────────────

export function InteractionCard({ interaction, onViewEmail }: { interaction: Interaction; onViewEmail?: (emailLogId: string) => void }) {
  const { t } = useTranslation()
  const typeIcons: Record<string, string> = {
    status_change: '●',
    agreement: '■',
    counter_offer: '◆',
    note: '✎',
    call: '☎',
    email: '✉',
  }

  const typeColors: Record<string, string> = {
    status_change: 'text-blue-500',
    agreement: 'text-green-500',
    counter_offer: 'text-purple-500',
    note: 'text-gray-500',
    call: 'text-orange-500',
    email: 'text-indigo-500',
  }

  const hasEmail = !!interaction.emailLogId
  const clickable = hasEmail && onViewEmail

  return (
    <div
      className={`flex gap-2 ${clickable ? 'cursor-pointer hover:bg-gray-50 rounded p-1 -m-1' : ''}`}
      onClick={clickable ? () => onViewEmail(interaction.emailLogId!) : undefined}
    >
      <span className={`${typeColors[interaction.type] ?? 'text-gray-400'} mt-0.5 shrink-0`}>
        {typeIcons[interaction.type] ?? '●'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-900">
          {interaction.content}
          {hasEmail && <span className="ml-1 text-indigo-500" title={t('common.viewEmail')}>✉</span>}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {interaction.authorName} — {new Date(interaction.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  )
}

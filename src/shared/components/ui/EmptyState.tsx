import type { ReactNode } from 'react'

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
      <h3 className="text-base font-medium text-slate-700 dark:text-slate-300">{title}</h3>
      {description && <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action}
    </div>
  )
}

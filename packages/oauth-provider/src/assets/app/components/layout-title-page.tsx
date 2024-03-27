import { HTMLAttributes, ReactNode } from 'react'
import { clsx } from '../lib/clsx'

export type LayoutTitlePageProps = {
  title?: ReactNode
  subtitle?: ReactNode
}

export function LayoutTitlePage({
  children,
  title,
  subtitle,
  ...attrs
}: LayoutTitlePageProps &
  Omit<HTMLAttributes<HTMLDivElement>, keyof LayoutTitlePageProps>) {
  return (
    <div
      {...attrs}
      className={clsx(
        attrs.className,
        'flex justify-center items-stretch min-h-screen bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100',
      )}
    >
      <div className="w-1/2 hidden p-4 md:grid content-center justify-items-end text-right dark:bg-transparent dark:border-r bg-slate-100 dark:bg-slate-800 dark:border-slate-700">
        {title && (
          <h1 className="text-3xl lg:text-5xl mt-4 font-semibold mb-4 text-primary">
            {title}
          </h1>
        )}

        {subtitle && (
          <p className="max-w-xs text-slate-500 dark:text-slate-500">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-stretch md:items-center w-full justify-center px-6 md:justify-start md:px-12">
        {children}
      </div>
    </div>
  )
}

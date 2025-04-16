import { clsx } from 'clsx'
import { JSX, ReactNode } from 'react'
import { Override } from '../../lib/util.ts'
import { LocaleSelector } from '../../locales/locale-selector.tsx'

export type LayoutTitlePageProps = Override<
  JSX.IntrinsicElements['div'],
  {
    title?: string
    subtitle?: ReactNode
    children?: ReactNode
  }
>

export function LayoutTitlePage({
  children,
  title,
  subtitle,

  // HTMLDivElement
  className,
  ...props
}: LayoutTitlePageProps) {
  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col items-center',
        'md:flex md:flex-row md:items-center md:justify-stretch',
        'min-w-screen min-h-screen',
        'bg-white text-slate-900',
        'dark:bg-slate-900 dark:text-slate-100',
      )}
    >
      {title && <title>{title}</title>}

      <div
        className={clsx(
          'px-6 pt-4',
          'w-full',
          'md:max-w-lg',
          'flex flex-row items-start',
          'md:flex-col md:items-end',
          'md:self-stretch',
          'md:max-w-fix md:w-1/2 md:p-4',
          'md:text-right',
          'md:dark:border-r md:dark:border-slate-700',
          'md:bg-slate-100 md:dark:bg-slate-800',
        )}
      >
        <div className="grid grow content-center md:justify-items-end">
          {title && (
            <h1
              key="title"
              className="text-primary text-xl font-semibold md:my-4 md:text-2xl lg:text-5xl"
            >
              {title}
            </h1>
          )}

          {subtitle && (
            <p
              key="subtitle"
              className="hidden max-w-xs text-slate-600 md:block dark:text-slate-400"
            >
              {subtitle}
            </p>
          )}
        </div>

        <LocaleSelector key="localeSelector" className="m-1 md:m-2" />
      </div>

      <main className="w-full p-6 md:max-w-3xl md:px-12">{children}</main>
    </div>
  )
}

import { JSX, ReactNode } from 'react'
import { clsx } from '../../lib/clsx.ts'
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
        'md:flex md:flex-row md:justify-stretch md:items-center',
        'min-h-screen min-w-screen',
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
          'flex flex-row md:flex-col',
          'md:self-stretch',
          'md:w-1/2 md:max-w-fix md:p-4',
          'md:text-right',
          'md:dark:border-r md:dark:border-slate-700',
          'md:bg-slate-100 md:dark:bg-slate-800',
        )}
      >
        <div className="flex-grow grid content-center md:justify-items-end">
          {title && (
            <h1
              key="title"
              className="text-xl md:text-2xl lg:text-5xl md:my-4 font-semibold text-brand"
            >
              {title}
            </h1>
          )}

          {subtitle && (
            <p
              key="subtitle"
              className="hidden md:block max-w-xs text-slate-600 dark:text-slate-400"
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

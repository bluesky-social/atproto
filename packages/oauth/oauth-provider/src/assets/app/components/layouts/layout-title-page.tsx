import { JSX, ReactNode } from 'react'
import { clsx } from '../../lib/clsx.ts'
import { Override } from '../../lib/util.ts'

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
          'md:max-w-lg',
          'md:grid md:content-center md:justify-items-end',
          'md:self-stretch',
          'md:w-1/2 md:max-w-fix md:p-4',
          'md:text-right',
          'md:dark:border-r md:dark:border-slate-700',
          'md:bg-slate-100 md:dark:bg-slate-800',
        )}
      >
        {title && (
          <h1 className="text-xl md:text-2xl lg:text-5xl md:mt-4 mb-4 font-semibold text-brand">
            {title}
          </h1>
        )}

        {subtitle && (
          <p className="hidden md:block max-w-xs text-slate-600 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="w-full px-6 md:max-w-3xl md:px-12">{children}</div>
    </div>
  )
}

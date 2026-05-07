import { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import { clsx } from 'clsx'
import { JSX, ReactNode } from 'react'
import { Override } from '#/lib/util.ts'
import { LocaleSelector } from '#/locales/locale-selector.tsx'

export type LayoutTitleProps = Override<
  JSX.IntrinsicElements['div'],
  {
    title?: string | MessageDescriptor
    subtitle?: ReactNode
  }
>

export function LayoutTitle({
  title,
  subtitle,

  // div
  className,
  children,
  ...props
}: LayoutTitleProps) {
  const { _ } = useLingui()

  const titleString =
    typeof title === 'string' ? title : title ? _(title) : undefined

  return (
    <div
      {...props}
      className={clsx(
        className,
        'flex flex-col items-center',
        'md:flex md:flex-row md:items-center md:justify-stretch',
        'min-w-screen min-h-screen',
      )}
    >
      <div
        className={clsx(
          'px-6 pt-4',
          'w-full',
          'md:max-w-lg',
          'flex flex-row items-center',
          'md:flex-col md:items-end',
          'md:self-stretch',
          'md:max-w-fix md:w-1/2',
          'md:px-4 md:py-2',
          'md:text-right',
          'md:dark:border-r md:dark:border-slate-700',
          'md:bg-contrast-25',
        )}
      >
        <div className="grid grow content-center md:justify-items-end">
          {titleString && (
            <h1
              key="title"
              className="text-primary text-xl font-semibold md:my-4 md:text-2xl lg:text-5xl"
            >
              <title>{titleString}</title>
              {titleString}
            </h1>
          )}

          {subtitle && (
            <p
              key="subtitle"
              className="text-text-light hidden max-w-xs md:block"
            >
              {subtitle}
            </p>
          )}
        </div>

        <LocaleSelector key="localeSelector" className="mr-auto text-sm" />
      </div>

      <main className="w-full p-6 md:max-h-screen md:max-w-3xl md:overflow-y-auto md:px-12">
        {children}
      </main>
    </div>
  )
}

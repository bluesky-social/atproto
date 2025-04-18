import { useLingui } from '@lingui/react/macro'
import { clsx } from 'clsx'
import { JSX } from 'react'
import type { CustomizationData } from '@atproto/oauth-provider-api'
import { Override } from '../../lib/util.ts'
import { LocaleSelector } from '../../locales/locale-selector.tsx'
import { LinkAnchor } from '../utils/link-anchor.tsx'

export type LayoutWelcomeProps = Override<
  JSX.IntrinsicElements['div'],
  {
    customizationData: CustomizationData | undefined
    title?: string
  }
>

export function LayoutWelcome({
  customizationData: { logo, name, links } = {},
  title = name,

  // div
  className,
  children,
  ...props
}: LayoutWelcomeProps) {
  const { t } = useLingui()

  return (
    <div
      {...props}
      className={clsx(
        'min-h-screen w-full',
        'flex flex-col items-center justify-center',
        'bg-white text-slate-900',
        'dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
    >
      {title && <title>{title}</title>}

      <main className="flex w-full grow flex-col items-center justify-center overflow-hidden p-6">
        {logo && (
          <img
            src={logo}
            alt={name || t`Logo`}
            aria-hidden
            className="mb-4 h-16 w-16 md:mb-8 md:h-24 md:w-24"
          />
        )}

        {name && (
          <h1 className="mx-4 mb-4 text-center text-2xl font-bold md:mb-8 md:text-4xl">
            {name}
          </h1>
        )}

        {children}
      </main>

      <footer className="bg-contrast-25 dark:bg-contrast-50 flex w-full flex-wrap items-center justify-between overflow-hidden px-4 md:px-6">
        <nav className="flex flex-wrap items-center justify-start">
          {links?.map((link, i) => (
            <LinkAnchor
              key={i}
              link={link}
              className="text-text-light m-2 text-xs hover:underline md:m-4 md:text-sm"
            />
          ))}
        </nav>

        <LocaleSelector
          className="m-1 text-xs md:m-2 md:text-sm"
          key="localeSelector"
        />
      </footer>
    </div>
  )
}

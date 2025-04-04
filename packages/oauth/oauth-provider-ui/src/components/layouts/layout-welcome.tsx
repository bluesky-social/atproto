import { JSX } from 'react'
import type { CustomizationData } from '@atproto/oauth-provider-api'
import { clsx } from '../../lib/clsx.ts'
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

      <main className="flex w-full flex-grow flex-col items-center justify-center overflow-hidden p-6">
        {logo && (
          <img
            src={logo}
            alt={name || `Logo`}
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

      <nav className="flex w-full flex-wrap content-center justify-center overflow-hidden border-t border-t-slate-200 dark:border-t-slate-700">
        {links?.map((link, i) => (
          <LinkAnchor
            key={i}
            link={link}
            className="text-brand m-2 text-xs hover:underline md:m-4 md:text-sm"
          />
        ))}

        <LocaleSelector
          className="m-1 text-xs md:m-2 md:text-sm"
          key="localeSelector"
        />
      </nav>
    </div>
  )
}

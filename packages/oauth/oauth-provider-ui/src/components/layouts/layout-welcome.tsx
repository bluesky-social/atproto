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
        'flex items-center justify-center flex-col',
        'bg-white text-slate-900',
        'dark:bg-slate-900 dark:text-slate-100',
        className,
      )}
    >
      {title && <title>{title}</title>}

      <main className="w-full overflow-hidden flex-grow flex flex-col items-center justify-center p-6">
        {logo && (
          <img
            src={logo}
            alt={name || `Logo`}
            aria-hidden
            className="w-16 h-16 md:w-24 md:h-24 mb-4 md:mb-8"
          />
        )}

        {name && (
          <h1 className="text-2xl md:text-4xl mb-4 md:mb-8 mx-4 text-center font-bold">
            {name}
          </h1>
        )}

        {children}
      </main>

      <nav className="w-full overflow-hidden border-t border-t-slate-200 dark:border-t-slate-700 flex flex-wrap justify-center content-center">
        {links?.map((link, i) => (
          <LinkAnchor
            key={i}
            link={link}
            className="m-2 md:m-4 text-xs md:text-sm text-brand hover:underline"
          />
        ))}

        <LocaleSelector
          className="m-1 md:m-2 text-xs md:text-sm"
          key="localeSelector"
        />
      </nav>
    </div>
  )
}

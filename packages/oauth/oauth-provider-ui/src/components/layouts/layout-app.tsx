import { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { ReactNode } from 'react'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { LocaleSelector } from '#/locales/locale-selector.tsx'
import { ExternalLinkTitle } from '../utils/external-link-title.tsx'

export type LayoutAppProps = {
  children?: ReactNode
  header?: ReactNode
  title?: string | MessageDescriptor
}

export function LayoutApp({ children, header, title }: LayoutAppProps) {
  const { _ } = useLingui()
  const { logo, name, links } = useCustomizationData()
  const titleString =
    typeof title === 'string' ? title : title ? _(title) : name

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <header className="flex items-center justify-between gap-4 p-4">
        {titleString && <title>{titleString}</title>}
        {logo && (
          <h1 className="flex min-w-0 truncate text-xl font-light text-slate-900 dark:text-white">
            <img
              src={logo}
              alt={name || _(msg`Logo`)}
              className="mr-4 h-6 object-contain object-left"
            />
            {titleString || name}
          </h1>
        )}

        {header}
      </header>

      <div className="flex w-full min-w-0 max-w-full flex-1 flex-col items-center justify-center">
        {children}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-4 p-4 text-xs">
        <LocaleSelector className="text-sm" />

        <nav className="grow-1 flex flex-wrap items-center justify-center gap-4">
          {links?.map((link) => (
            <a
              href={link.href}
              className="text-light whitespace-nowrap hover:underline focus:underline focus:outline-none"
              key={link.href}
              role="link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkTitle link={link} />
            </a>
          ))}
        </nav>
      </footer>
    </div>
  )
}

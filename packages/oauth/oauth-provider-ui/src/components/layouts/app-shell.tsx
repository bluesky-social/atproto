import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { ReactNode } from 'react'
import { LinkAnchor } from '#/components/utils/link-anchor.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { LocaleSelector } from '#/locales/locale-selector.tsx'

export type AppShellProps = {
  children?: ReactNode
  header?: ReactNode
  title?: string | MessageDescriptor
}

export function AppShell({ children, header, title }: AppShellProps) {
  const { _ } = useLingui()
  const { logo, name, links } = useCustomizationData()
  const titleString = typeof title === 'object' ? _(title) : title ?? name

  return (
    <div className="bg-background text-foreground flex min-h-dvh w-full flex-col">
      <header className="flex items-center justify-between gap-4 p-4">
        {/* @NOTE This <title> render is what the pds e2e helper
          `assertTitle(...)` reads. Keep it. */}
        {titleString && <title>{titleString}</title>}

        {logo && (
          <h1 className="flex min-w-0 truncate text-xl font-light capitalize">
            <img
              src={logo}
              alt={name || _(msg`Logo`)}
              className="mr-4 h-6 object-contain object-left"
            />
            {titleString ?? name}
          </h1>
        )}

        {header}
      </header>

      <div className="flex w-full min-w-0 max-w-full flex-1 flex-col items-center justify-center">
        {children}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-4 px-6 py-4 text-xs md:px-8">
        <LocaleSelector className="mr-auto" />

        {links?.map((link) => (
          <LinkAnchor
            key={link.href}
            link={link}
            className="text-muted-foreground hover:text-foreground focus-visible:text-foreground rounded-sm transition-colors hover:underline focus-visible:underline focus-visible:outline-none"
          />
        ))}
      </footer>
    </div>
  )
}

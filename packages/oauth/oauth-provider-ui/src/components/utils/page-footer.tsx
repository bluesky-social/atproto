import { JSX } from 'react'
import { Override } from '#/lib/util'
import { LocaleSelector } from '#/locales/locale-selector.tsx'
import type {
  CustomizationData,
  LinkDefinition,
} from '@atproto/oauth-provider-api'
import { LinkAnchor } from './link-anchor.tsx'

export type { CustomizationData }
export type PageFooterProps = Override<
  JSX.IntrinsicElements['footer'],
  {
    links?: LinkDefinition[]
  }
>

export function PageFooter({
  links,

  // footer
  className = '',
  ...props
}: PageFooterProps) {
  return (
    <footer
      className={`bg-contrast-25 dark:bg-contrast-50 flex w-full flex-wrap items-center justify-between overflow-hidden px-4 md:px-6 ${className}`}
      {...props}
    >
      <nav className="flex flex-wrap items-center justify-start">
        {links?.map((link, i) => (
          <LinkAnchor
            key={i}
            link={link}
            className="text-text-light m-2 text-xs hover:underline md:m-4 md:text-sm"
          />
        ))}
      </nav>

      <LocaleSelector className="m-1 text-xs md:m-2 md:text-sm" />
    </footer>
  )
}

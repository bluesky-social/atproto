import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { type JSX, type ReactNode, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { LinkAnchor } from '#/components/utils/link-anchor.tsx'
import { ShortLinkTitle } from '#/components/utils/link-title.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
import { LocaleSelector } from '#/locales/locale-selector.tsx'

export type AuthShellProps = Override<
  JSX.IntrinsicElements['div'],
  {
    title?: string | MessageDescriptor
    subtitle?: ReactNode
    /**
     * Overrides the `<title>` when the document title differs from the card
     * heading. Defaults to `title`, which is what nearly every screen wants.
     */
    documentTitle?: string | MessageDescriptor
  }
>

/**
 * The authorize-flow surface.
 *
 * @NOTE This owns the whole page frame: the `<title>`, the locale selector and
 * the footer links. Never nest it inside another shell — both render a
 * `<title>`, React hoists them all into the head, and the last one wins.
 */
export function AuthShell({
  title,
  subtitle,
  documentTitle = title,

  // div
  className,
  children,
  ...props
}: AuthShellProps) {
  const { _ } = useLingui()
  const { logo, name, links } = useCustomizationData()

  // The branded background lives on <html> (see `.auth-background` in
  // style.css) so it also covers overscroll and the safe areas on phones.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('auth-background')
    return () => root.classList.remove('auth-background')
  }, [])

  const titleString =
    typeof title === 'string' ? title : title ? _(title) : undefined

  const documentTitleString =
    typeof documentTitle === 'string'
      ? documentTitle
      : documentTitle
        ? _(documentTitle)
        : undefined

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4 sm:p-6 md:p-10">
      {documentTitleString && <title>{documentTitleString}</title>}

      <div
        {...props}
        className={cn('max-w-auth-card flex w-full flex-col', className)}
      >
        {/* @NOTE Wider than the stock card. `cn` is tailwind-merge, so this
          replaces `Card`'s own `--card-spacing` utility rather than racing it. */}
        <Card className="[--card-spacing:--spacing(6)]">
          {/* @NOTE The logo stands alone when there is one — the service name
            is carried by its alt text — and only falls back to the name in
            text when the deployment has no logo. */}
          {(logo || name) && (
            <div className="flex items-center justify-center px-(--card-spacing) pt-2">
              {logo ? (
                <img
                  src={logo}
                  alt={name || _(msg`Logo`)}
                  className="h-9 w-auto max-w-32 object-contain"
                />
              ) : (
                <span className="text-lg font-semibold">{name}</span>
              )}
            </div>
          )}

          {(titleString || subtitle) && (
            <CardHeader className="gap-2 text-center">
              {titleString && (
                <CardTitle className="text-2xl leading-tight font-semibold text-balance whitespace-pre-line">
                  {titleString}
                </CardTitle>
              )}
              {/* @NOTE CardDescription renders a <div>, so the subtitle gets
                its own <p>. */}
              {subtitle && (
                <CardDescription className="text-base">
                  <p>{subtitle}</p>
                </CardDescription>
              )}
            </CardHeader>
          )}

          <CardContent>{children}</CardContent>

          <CardFooter className="flex-col justify-center gap-4 border-t-0 bg-transparent pt-2">
            {/* @NOTE Same height as the action buttons; the trigger sizes
              itself through a data attribute, so the override carries the
              same variant. */}
            <LocaleSelector className="text-action px-3 data-[size=sm]:h-10" />
            {links?.length ? (
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-base whitespace-nowrap">
                {links.map((link) => (
                  <LinkAnchor
                    key={link.href}
                    link={link}
                    className="hover:text-foreground rounded-sm transition-colors hover:underline"
                  >
                    <ShortLinkTitle link={link} />
                  </LinkAnchor>
                ))}
              </div>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import type { CSSProperties, JSX, ReactNode } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { LinkAnchor } from '#/components/utils/link-anchor.tsx'
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
 * The footer names the standard links by one word each — "Terms" rather
 * than "Terms of Service" — keyed on the link's `rel`, so all four fit on one
 * line at phone width. A link with any other `rel` keeps its own title.
 */
function shortLinkLabel(rel: string | undefined): ReactNode {
  switch (rel) {
    case 'canonical':
      return <Trans>Home</Trans>
    case 'terms-of-service':
      return <Trans>Terms</Trans>
    case 'privacy-policy':
      return <Trans>Privacy</Trans>
    case 'help':
      return <Trans>Support</Trans>
    default:
      return undefined
  }
}

/**
 * The card's inner spacing. `Card` sets `--card-spacing` to 1rem through an
 * arbitrary-property utility; a competing utility would race it in the
 * stylesheet, so the wider auth spacing is set inline instead.
 */
const cardSpacing = { '--card-spacing': '1.5rem' } as CSSProperties

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

  const titleString =
    typeof title === 'string' ? title : title ? _(title) : undefined

  const documentTitleString =
    typeof documentTitle === 'string'
      ? documentTitle
      : documentTitle
        ? _(documentTitle)
        : undefined

  return (
    <div className="auth-background flex min-h-svh flex-col items-center justify-center gap-6 p-4 sm:p-6 md:p-10">
      {documentTitleString && <title>{documentTitleString}</title>}

      <div
        {...props}
        className={cn('flex w-full max-w-[26rem] flex-col', className)}
      >
        <Card style={cardSpacing}>
          {/* @NOTE The logo stands alone when there is one — the service name
            is carried by its alt text — and only falls back to the name in
            text when the deployment has no logo. */}
          {(logo || name) && (
            <div className="px-(--card-spacing) flex items-center justify-center pt-2">
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
                <CardTitle className="whitespace-pre-line text-balance text-2xl font-semibold leading-tight">
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
            <LocaleSelector className="px-3 text-[15px] data-[size=sm]:h-10" />
            {links?.length ? (
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 whitespace-nowrap text-base">
                {links.map((link) => (
                  <LinkAnchor
                    key={link.href}
                    link={link}
                    className="hover:text-foreground rounded-sm transition-colors hover:underline"
                  >
                    {shortLinkLabel(link.rel)}
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

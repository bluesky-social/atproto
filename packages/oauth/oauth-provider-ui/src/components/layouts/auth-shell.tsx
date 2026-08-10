import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import type { JSX, ReactNode } from 'react'
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
    <div className="auth-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      {documentTitleString && <title>{documentTitleString}</title>}

      <div
        {...props}
        className={cn('flex w-full max-w-sm flex-col', className)}
      >
        <Card>
          {(logo || name) && (
            <div className="px-(--card-spacing) flex items-center justify-center gap-2 pt-2 font-medium">
              {logo && (
                <img
                  src={logo}
                  alt={name || _(msg`Logo`)}
                  className="size-6 object-contain"
                />
              )}
              {name}
            </div>
          )}

          {(titleString || subtitle) && (
            <CardHeader className="text-center">
              {titleString && (
                <CardTitle className="text-xl">{titleString}</CardTitle>
              )}
              {/* @NOTE CardDescription renders a <div>, so the subtitle gets
                its own <p>. */}
              {subtitle && (
                <CardDescription>
                  <p>{subtitle}</p>
                </CardDescription>
              )}
            </CardHeader>
          )}

          <CardContent>{children}</CardContent>

          <CardFooter className="flex-col justify-center gap-3">
            <LocaleSelector />
            {links?.length ? (
              <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
                {links.map((link) => (
                  <LinkAnchor
                    key={link.href}
                    link={link}
                    className="hover:text-foreground rounded-sm transition-colors hover:underline"
                  />
                ))}
              </div>
            ) : null}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

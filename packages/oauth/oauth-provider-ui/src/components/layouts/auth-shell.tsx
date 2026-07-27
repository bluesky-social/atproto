import type { MessageDescriptor } from '@lingui/core'
import { useLingui } from '@lingui/react'
import type { JSX, ReactNode } from 'react'
import { AppShell } from '#/components/layouts/app-shell.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'

export type AuthShellProps = Override<
  JSX.IntrinsicElements['div'],
  {
    title?: string | MessageDescriptor
    subtitle?: ReactNode
  }
>

/**
 * The authorize-flow surface, replacing the previous split-panel `LayoutTitle`.
 *
 * A single centred card inside `AppShell`, so the sign-in, sign-up, consent and
 * reset-password steps all share one frame instead of each screen owning its
 * own two-column layout.
 */
export function AuthShell({
  title,
  subtitle,

  // div
  className,
  children,
  ...props
}: AuthShellProps) {
  const { _ } = useLingui()

  const titleString =
    typeof title === 'string' ? title : title ? _(title) : undefined

  return (
    <AppShell title={title}>
      <div
        {...props}
        className={cn('w-full max-w-lg px-4 py-6 md:py-10', className)}
      >
        <Card>
          {(titleString || subtitle) && (
            <CardHeader>
              {titleString && (
                <CardTitle className="text-2xl font-semibold">
                  {titleString}
                </CardTitle>
              )}
              {/* @NOTE CardDescription is a <div> upstream; the subtitle is
                wrapped in a <p> so unqualified `ensureTextVisibility` calls
                keep matching. */}
              {subtitle && (
                <CardDescription>
                  <p>{subtitle}</p>
                </CardDescription>
              )}
            </CardHeader>
          )}

          <CardContent>{children}</CardContent>
        </Card>
      </div>
    </AppShell>
  )
}

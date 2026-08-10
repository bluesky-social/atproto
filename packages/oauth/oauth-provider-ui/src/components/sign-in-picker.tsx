import { Trans, useLingui } from '@lingui/react/macro'
import { AtSignIcon, ChevronRightIcon } from 'lucide-react'
import type { JSX, ReactNode } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import { Button } from '#/components/ui/button.tsx'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemTitle,
} from '#/components/ui/item.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
import { AccountCard } from './utils/account-card.tsx'
import { stringifyHandle } from './utils/handle.tsx'

export type SignInPickerProps = Override<
  JSX.IntrinsicElements['div'],
  {
    sessions: readonly Session[]

    onSession: (session: Session) => void
    onOther?: () => void
    onBack?: () => void
    onSignUp?: () => void

    backLabel?: ReactNode
  }
>

export function SignInPicker({
  sessions,

  onSession,
  onOther = undefined,
  onBack,
  onSignUp,

  backLabel,

  // div
  children,
  className,
  ...props
}: SignInPickerProps) {
  const { t } = useLingui()

  return (
    <div {...props} className={cn('flex flex-col gap-4', className)}>
      <p className="text-muted-foreground text-sm font-medium">
        <Trans>Sign in as...</Trans>
      </p>

      {sessions.map((session) => (
        <AccountCard
          key={session.account.did}
          account={session.account}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()

            onSession(session)
          }}
          aria-label={t`Sign in as ${session.account.name ?? stringifyHandle(session.account.handle) ?? session.account.did}`}
        />
      ))}

      {/* @NOTE Built on the same `Item` primitive as `AccountCard` above. The
        two rows sit side by side and previously repeated the same border,
        padding, hover and focus utilities by hand, which had already drifted
        apart between them. */}
      {onOther && (
        <Item
          key="other"
          variant="outline"
          render={<button type="button" />}
          onClick={onOther}
          aria-label={t`Sign in to an account that is not listed`}
          className="hover:bg-accent hover:text-accent-foreground w-full text-left"
        >
          <ItemMedia variant="icon">
            <AtSignIcon aria-hidden className="size-5" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <span className="text-muted-foreground truncate">
                <Trans>Another account</Trans>
              </span>
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRightIcon aria-hidden className="size-4 shrink-0" />
          </ItemActions>
        </Item>
      )}

      {children}

      <div key="actions" className="flex flex-col gap-2">
        {onBack && (
          <Button variant="secondary" className="w-full" onClick={onBack}>
            {backLabel || <Trans>Back</Trans>}
          </Button>
        )}

        {onSignUp && (
          <Button className="w-full" onClick={onSignUp}>
            <Trans>Sign up</Trans>
          </Button>
        )}
      </div>
    </div>
  )
}

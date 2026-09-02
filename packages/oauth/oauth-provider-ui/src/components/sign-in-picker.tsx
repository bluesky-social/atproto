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
import { AccountCard, accountRowClassName } from './utils/account-card.tsx'
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

      {/* @NOTE Built on the same `Item` primitive as `AccountCard` above and
        sharing its row utilities, so the two rows keep the same height,
        padding and surface. The icon sits in a disc the size of the avatar so
        the text column lines up with the account rows. */}
      {onOther && (
        <Item
          key="other"
          variant="outline"
          render={<button type="button" />}
          onClick={onOther}
          aria-label={t`Sign in to an account that is not listed`}
          className={accountRowClassName}
        >
          <ItemMedia className="bg-muted text-muted-foreground size-12 rounded-full">
            <AtSignIcon aria-hidden className="size-6" />
          </ItemMedia>
          <ItemContent className="min-w-0">
            <ItemTitle className="w-full text-lg leading-tight">
              <span className="text-muted-foreground block min-w-0 truncate font-medium">
                <Trans>Another account</Trans>
              </span>
            </ItemTitle>
          </ItemContent>
          <ItemActions>
            <ChevronRightIcon
              aria-hidden
              className="text-muted-foreground size-5 shrink-0"
            />
          </ItemActions>
        </Item>
      )}

      {children}

      <div key="actions" className="flex flex-col gap-3 pt-2">
        {onSignUp && (
          <>
            <p className="text-muted-foreground text-center text-base">
              <Trans>Need an account?</Trans>
            </p>
            <Button className="h-10 w-full text-base" onClick={onSignUp}>
              <Trans>Sign up</Trans>
            </Button>
          </>
        )}

        {onBack && (
          <Button
            variant="secondary"
            className="h-10 w-full text-base"
            onClick={onBack}
          >
            {backLabel || <Trans>Back</Trans>}
          </Button>
        )}
      </div>
    </div>
  )
}

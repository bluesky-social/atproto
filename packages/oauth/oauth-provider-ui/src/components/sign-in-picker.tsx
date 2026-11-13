import { Trans, useLingui } from '@lingui/react/macro'
import type { JSX, ReactNode } from 'react'
import type { Session } from '@atproto/oauth-provider-api'
import { ActionButton } from '#/components/forms/form-shell.tsx'
import type { Override } from '#/lib/util.ts'
import { cn } from '#/lib/utils.ts'
import { AccountCard, OtherAccountCard } from './utils/account-card.tsx'
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
          onClick={() => onSession(session)}
          aria-label={t`Sign in as ${session.account.name ?? stringifyHandle(session.account.handle) ?? session.account.did}`}
        />
      ))}

      {/* @NOTE Built on the same `Item` primitive as `AccountCard` above and
        sharing its row utilities, so the two rows keep the same height,
        padding and surface. The icon sits in a disc the size of the avatar so
        the text column lines up with the account rows. */}
      {onOther && (
        <OtherAccountCard
          key="other"
          variant="outline"
          onClick={onOther}
          aria-label={t`Sign in to an account that is not listed`}
        />
      )}

      {children}

      <div key="actions" className="flex flex-col gap-2 pt-2">
        {onSignUp && (
          <>
            <p className="text-muted-foreground pb-1 text-center text-base">
              <Trans>Need an account?</Trans>
            </p>
            <ActionButton className="w-full" onClick={onSignUp}>
              <Trans>Sign up</Trans>
            </ActionButton>
          </>
        )}

        {onBack && (
          <ActionButton variant="secondary" className="w-full" onClick={onBack}>
            {backLabel || <Trans>Back</Trans>}
          </ActionButton>
        )}
      </div>
    </div>
  )
}

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import type { Account } from '@atproto/oauth-provider-api'
import { AsyncButton } from '#/components/forms/async-button.tsx'
import { AccountIdentifier } from '#/components/identity/account-identifier.tsx'
import { AccountSummary } from '#/components/identity/account-summary.tsx'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'

export type ReactivateAccountViewProps = {
  account: Account
  onReactivate: () => void | PromiseLike<void>
  onCancel?: () => void | PromiseLike<void>
}

export function ReactivateAccountView({
  account,
  onReactivate,
  onCancel,
}: ReactivateAccountViewProps) {
  return (
    <AuthShell
      title={msg`Welcome back!`}
      subtitle={<Trans>Your account is currently deactivated.</Trans>}
    >
      <div className="flex w-full max-w-md flex-col items-stretch gap-6">
        <AccountSummary account={account} />

        <p className="text-muted-foreground text-center">
          <Trans>
            You previously deactivated <AccountIdentifier account={account} />.
            You can reactivate your account to continue logging in. Your content
            (profile, posts, feeds, lists, etc.) will become visible again to
            other users.
          </Trans>
        </p>

        <div className="flex flex-col gap-3">
          <AsyncButton className="w-full" action={onReactivate}>
            <Trans>Yes, reactivate my account</Trans>
          </AsyncButton>

          {onCancel && (
            <AsyncButton
              variant="secondary"
              className="w-full"
              action={onCancel}
            >
              <Trans>Cancel</Trans>
            </AsyncButton>
          )}
        </div>
      </div>
    </AuthShell>
  )
}

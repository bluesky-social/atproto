import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { AuthShell } from '#/components/layouts/auth-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { Separator } from '#/components/ui/separator.tsx'

export type AuthenticateWelcomeViewParams = {
  onSignIn?: () => void
  onSignUp?: () => void
  onCancel?: () => void
}

/**
 * @NOTE The only screen whose document title differs from its card heading —
 * the card reads "Welcome" while the title must stay "Authenticate" — which is
 * why this is the one caller that passes `documentTitle`.
 */
export function AuthenticateWelcomeView({
  onSignUp,
  onSignIn,
  onCancel,
}: AuthenticateWelcomeViewParams) {
  return (
    <AuthShell
      documentTitle={msg({
        message: 'Authenticate',
        context: 'AuthenticationPage',
      })}
      title={msg`Welcome`}
      subtitle={<Trans>Please authenticate to continue</Trans>}
    >
      <div className="flex w-full flex-col gap-3">
        {onSignUp && (
          <Button
            className="w-full"
            variant={onSignIn ? 'default' : 'secondary'}
            onClick={onSignUp}
          >
            <Trans>Create a new account</Trans>
          </Button>
        )}

        {onSignIn && (
          <Button
            className="w-full"
            variant={onSignUp ? 'secondary' : 'default'}
            onClick={onSignIn}
          >
            <Trans context="verb">Sign in</Trans>
          </Button>
        )}

        {onCancel && (
          <>
            <Separator className="my-2" />

            <Button className="w-full" variant="secondary" onClick={onCancel}>
              <Trans>Cancel</Trans>
            </Button>
          </>
        )}
      </div>
    </AuthShell>
  )
}

import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { AppShell } from '#/components/layouts/app-shell.tsx'
import { Button } from '#/components/ui/button.tsx'

export type AuthenticateWelcomeViewParams = {
  onSignIn?: () => void
  onSignUp?: () => void
  onCancel?: () => void
}

export function AuthenticateWelcomeView({
  onSignUp,
  onSignIn,
  onCancel,
}: AuthenticateWelcomeViewParams) {
  return (
    <AppShell
      title={msg({ message: 'Authenticate', context: 'AuthenticationPage' })}
    >
      <div className="md:bg-background flex w-full max-w-md flex-col items-center px-6 pb-8 pt-12 md:rounded-lg md:border md:border-slate-200 md:px-8 md:shadow-md md:dark:border-slate-700 md:dark:shadow-xl">
        <div className="mb-8 text-center">
          <h2 className="text-foreground mb-3 text-2xl font-light dark:text-white">
            <Trans>Welcome</Trans>
          </h2>
          <p className="text-muted-foreground">
            <Trans>Please authenticate to continue</Trans>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {onSignUp && (
            <Button
              className={'w-full'}
              variant={onSignIn ? 'default' : 'secondary'}
              onClick={onSignUp}
            >
              <Trans>Create a new account</Trans>
            </Button>
          )}

          {onSignIn && (
            <Button
              className={'w-full'}
              variant={onSignUp ? 'secondary' : 'default'}
              onClick={onSignIn}
            >
              <Trans context="verb">Sign in</Trans>
            </Button>
          )}

          {onCancel && (
            <>
              <hr className="my-2 border-slate-200 dark:border-slate-700" />

              <Button className="w-full" variant="secondary" onClick={onCancel}>
                <Trans>Cancel</Trans>
              </Button>
            </>
          )}
        </div>
      </div>
    </AppShell>
  )
}

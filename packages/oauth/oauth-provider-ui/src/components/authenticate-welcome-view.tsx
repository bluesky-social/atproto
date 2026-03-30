import { msg } from '@lingui/core/macro'
import { Trans } from '@lingui/react/macro'
import { Button } from './forms/button.tsx'
import { LayoutApp } from './layouts/layout-app.tsx'

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
    <LayoutApp
      title={msg({ message: 'Authenticate', context: 'AuthenticationPage' })}
    >
      <div className="flex w-full max-w-md flex-col items-center px-6 pb-8 pt-12 md:rounded-lg md:border md:border-slate-200 md:bg-white md:px-8 md:shadow-md md:dark:border-slate-700 md:dark:bg-slate-800 md:dark:shadow-xl">
        <div className="mb-8 text-center">
          <h2 className="mb-3 text-2xl font-light text-slate-900 dark:text-white">
            <Trans>Welcome</Trans>
          </h2>
          <p className="text-slate-600 dark:text-slate-400">
            <Trans>Please authenticate to continue</Trans>
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {onSignUp && (
            <Button
              className={'w-full'}
              color={onSignIn ? 'primary' : 'darkGrey'}
              onClick={onSignUp}
            >
              <Trans>Create a new account</Trans>
            </Button>
          )}

          {onSignIn && (
            <Button
              className={'w-full'}
              color={onSignUp ? 'darkGrey' : 'primary'}
              onClick={onSignIn}
            >
              <Trans context="verb">Sign in</Trans>
            </Button>
          )}

          {onCancel && (
            <>
              <hr className="my-2 border-slate-200 dark:border-slate-700" />

              <Button className="w-full" color="darkGrey" onClick={onCancel}>
                <Trans>Cancel</Trans>
              </Button>
            </>
          )}
        </div>
      </div>
    </LayoutApp>
  )
}

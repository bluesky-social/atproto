import { Trans, useLingui } from '@lingui/react/macro'
import { Button } from '../../../components/forms/button.tsx'
import {
  LayoutWelcome,
  LayoutWelcomeProps,
} from '../../../components/layouts/layout-welcome.tsx'
import { Override } from '../../../lib/util.ts'

export type WelcomeViewParams = Override<
  LayoutWelcomeProps,
  {
    onSignIn?: () => void
    onSignUp?: () => void
    onCancel?: () => void
  }
>

export function WelcomeView({
  onSignUp,
  onSignIn,
  onCancel,

  // LayoutWelcome
  ...props
}: WelcomeViewParams) {
  const { t } = useLingui()
  return (
    <LayoutWelcome {...props} title={props.title ?? t`Authenticate`}>
      {onSignUp && (
        <Button
          className={'m-1 w-60 min-w-min max-w-full'}
          color={onSignIn ? 'primary' : undefined}
          onClick={onSignUp}
        >
          <Trans>Create a new account</Trans>
        </Button>
      )}

      {onSignIn && (
        <Button
          className={'m-1 w-60 min-w-min max-w-full'}
          color={onSignUp ? undefined : 'primary'}
          onClick={onSignIn}
        >
          <Trans context="verb">Sign in</Trans>
        </Button>
      )}

      {onCancel && (
        <Button className="m-1 w-60 min-w-min max-w-full" onClick={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
      )}
    </LayoutWelcome>
  )
}

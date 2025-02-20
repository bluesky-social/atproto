import { Button } from '../../../components/forms/button'
import {
  LayoutWelcome,
  LayoutWelcomeProps,
} from '../../../components/layouts/layout-welcome'
import { Override } from '../../../lib/util'

export type WelcomeViewParams = Override<
  LayoutWelcomeProps,
  {
    onSignIn?: () => void
    signInLabel?: string

    onSignUp?: () => void
    signUpLabel?: string

    onCancel?: () => void
    cancelLabel?: string
  }
>

export function WelcomeView({
  onSignUp,
  signUpLabel = 'Create a new account',
  onSignIn,
  signInLabel = 'Sign in',
  onCancel,
  cancelLabel = 'Cancel',

  // LayoutWelcome
  ...props
}: WelcomeViewParams) {
  return (
    <LayoutWelcome {...props}>
      {onSignUp && (
        <Button
          className={'m-1 w-60 max-w-full'}
          color={onSignIn ? 'brand' : undefined}
          onClick={onSignUp}
        >
          {signUpLabel}
        </Button>
      )}

      {onSignIn && (
        <Button
          className={'m-1 w-60 max-w-full'}
          color={onSignUp ? undefined : 'brand'}
          onClick={onSignIn}
        >
          {signInLabel}
        </Button>
      )}

      {onCancel && (
        <Button className="m-1 w-60 max-w-full" onClick={onCancel}>
          {cancelLabel}
        </Button>
      )}
    </LayoutWelcome>
  )
}

import { LayoutWelcome, LayoutWelcomeProps } from '../components/layout-welcome'
import { clsx } from '../lib/clsx'

export type WelcomeViewParams = LayoutWelcomeProps & {
  onSignIn?: () => void
  signInLabel?: string

  onSignUp?: () => void
  signUpLabel?: string

  onCancel?: () => void
  cancelLabel?: string
}

export function WelcomeView({
  onSignUp,
  signUpLabel = 'Create a new account',
  onSignIn,
  signInLabel = 'Sign in',
  onCancel,
  cancelLabel = 'Cancel',

  ...props
}: WelcomeViewParams) {
  return (
    <LayoutWelcome {...props}>
      {onSignUp && (
        <button
          className={clsx(
            'm-1 w-60 max-w-full text-white py-2 px-4 rounded-full truncate',
            onSignIn ? 'bg-primary' : 'bg-slate-400',
          )}
          onClick={onSignUp}
        >
          {signUpLabel}
        </button>
      )}

      {onSignIn && (
        <button
          className={clsx(
            'm-1 w-60 max-w-full py-2 px-4 rounded-full truncate',
            onSignUp ? 'bg-slate-100 dark:bg-slate-700' : 'bg-primary',
          )}
          onClick={onSignIn}
        >
          {signInLabel}
        </button>
      )}

      {onCancel && (
        <button
          className="m-1 w-60 max-w-full bg-transparent text-primary py-2 px-4 rounded-full truncate font-light"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      )}
    </LayoutWelcome>
  )
}

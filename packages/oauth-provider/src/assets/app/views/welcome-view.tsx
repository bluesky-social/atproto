import { WelcomeLayout, WelcomeLayoutProps } from '../components/welcome-layout'

export type WelcomeViewParams = WelcomeLayoutProps & {
  onSignIn?: () => void
  signInLabel?: string

  onSignUp?: () => void
  signUpLabel?: string

  onCancel?: () => void
  cancelLabel?: string
}

export function WelcomeView({
  onSignIn,
  signInLabel = 'Sign in',
  onSignUp,
  signUpLabel = 'Sign up',
  onCancel,
  cancelLabel = 'Cancel',

  ...props
}: WelcomeViewParams) {
  return (
    <WelcomeLayout {...props}>
      {onSignIn && (
        <button
          className="m-1 w-40 max-w-full bg-primary text-white py-2 px-4 rounded-full truncate"
          onClick={onSignIn}
        >
          {signInLabel}
        </button>
      )}

      {onSignUp && (
        <button
          className="m-1 w-40 max-w-full bg-slate-400 text-white py-2 px-4 rounded-full truncate"
          onClick={onSignUp}
        >
          {signUpLabel}
        </button>
      )}

      {onCancel && (
        <button
          className="m-1 w-40 max-w-full bg-transparent text-primary py-2 px-4 rounded-full truncate font-light"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      )}
    </WelcomeLayout>
  )
}

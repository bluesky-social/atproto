export type WelcomeViewParams = {
  title?: string
  logo?: string
  logoAlt?: string

  onSignIn?: () => void
  signInLabel?: string

  onSignUp?: () => void
  signUpLabel?: string

  onCancel?: () => void
  cancelLabel?: string
}

export function WelcomeView({
  title,
  logo,
  logoAlt = title || 'Logo',
  onSignIn,
  signInLabel = 'Sign in',
  onSignUp,
  signUpLabel = 'Sign up',
  onCancel,
  cancelLabel = 'Cancel',
}: WelcomeViewParams) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white text-black dark:bg-black dark:text-white">
      {logo && <img src={logo} alt={logoAlt} className="w-24 h-24" />}

      {title && <h1 className="text-4xl mt-10 mb-5 font-bold">{title}</h1>}

      {onSignIn && (
        <button
          className="mt-2 w-40 bg-primary text-white py-2 px-4 rounded-full"
          onClick={onSignIn}
        >
          {signInLabel}
        </button>
      )}

      {onSignUp && (
        <button
          className="mt-2 w-40 bg-slate-400 text-white py-2 px-4 rounded-full"
          onClick={onSignUp}
        >
          {signUpLabel}
        </button>
      )}

      {onCancel && (
        <button
          className="mt-2 w-40 bg-transparent text-primary py-2 px-4 rounded-full"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      )}
    </div>
  )
}

export type WelcomeViewParams = {
  title?: string
  logo?: string
  logoAlt?: string
  links?: Array<{
    name: string
    href: string
    rel?: string
  }>

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
  links,
  onSignIn,
  signInLabel = 'Sign in',
  onSignUp,
  signUpLabel = 'Sign up',
  onCancel,
  cancelLabel = 'Cancel',
}: WelcomeViewParams) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center flex-col bg-white text-black dark:bg-black dark:text-white">
      <div className="w-full max-w-screen-sm overflow-hidden flex-grow flex flex-col items-center justify-center">
        {logo && (
          <img src={logo} alt={logoAlt} className="w-16 h-16 md:w-24 md:h-24" />
        )}

        {title && (
          <h1 className="text-2xl md:text-4xl mt-10 mb-5 mx-4 text-center font-bold">
            {title}
          </h1>
        )}

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
            className="m-1 w-40 max-w-full bg-transparent text-primary py-2 px-4 rounded-full truncate"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        )}
      </div>

      {links != null && links.length > 0 && (
        <nav className="w-full max-w-screen-sm overflow-hidden mt-4 border-t border-t-slate-200 flex flex-wrap justify-center">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              rel={link.rel}
              target="_blank"
              className="m-2 md:m-4 text-xs md:text-sm text-primary hover:underline"
            >
              {link.name}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}

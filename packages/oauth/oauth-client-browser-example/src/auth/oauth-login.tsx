import { Button } from '../components/button.tsx'
import { useAuthContext } from './auth-provider.tsx'
import { OAuthLoginForm } from './oauth-login-form.tsx'

export type OAuthLoginProps = {
  titleText?: string | null | false
  signUpText?: string
}

/**
 * @returns Nice tailwind css form asking to enter either a handle or the host
 *   to use to login.
 */
export function OAuthLogin({
  titleText = 'Sign-in with your atproto account',
  signUpText = 'Login or signup with {host}',
}: OAuthLoginProps) {
  const { signedIn, signIn, signUpUrl } = useAuthContext()
  if (signedIn) return null

  return (
    <div
      className="flex w-[450px] max-w-full flex-col items-stretch space-y-4 rounded-md bg-white p-4 shadow-md"
      role="dialog"
    >
      {titleText && (
        <h2 className="text-center text-2xl font-medium">{titleText}</h2>
      )}

      {signUpUrl && (
        <Button type="button" size="large" action={() => signIn(signUpUrl)}>
          {signUpText.replace('{host}', new URL(signUpUrl).host)}
        </Button>
      )}

      <OAuthLoginForm signIn={signIn} />
    </div>
  )
}

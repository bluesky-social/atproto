import { useSession } from '@/components/SessionProvider'
import { SignInForm } from '@/components/SignInForm'

export default function SignIn() {
  const { isLoading, isLoggedIn, signIn } = useSession()
  return <SignInForm disabled={isLoading || isLoggedIn} signIn={signIn} />
}

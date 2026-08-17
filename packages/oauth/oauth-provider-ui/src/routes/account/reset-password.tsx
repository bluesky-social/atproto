import { createFileRoute, useRouter } from '@tanstack/react-router'
import { ErrorView } from '#/components/error-view.tsx'
import { ResetPasswordView } from '#/components/reset-password-view.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

export const Route = createFileRoute('/account/reset-password')({
  // Carries the address the user typed on the sign-in form, so they don't have
  // to type it again.
  // @NOTE The parameter type is what makes the search params *optional* at
  // every `<Link>` and `navigate()`: TanStack derives the input type from it,
  // so a required `Record<string, unknown>` would force every caller to pass
  // one.
  validateSearch: (search: { email?: unknown }): { email?: string } =>
    typeof search.email === 'string' ? { email: search.email } : {},
  component: ResetPasswordPage,
  errorComponent: ErrorView,
})

function ResetPasswordPage() {
  const { api } = useSessionContext()
  const { email } = Route.useSearch()

  const router = useRouter()

  return (
    <ResetPasswordView
      emailDefault={email}
      onResetPasswordRequest={async (data) => api.initiatePasswordReset(data)}
      onResetPasswordConfirm={async (data) => api.confirmResetPassword(data)}
      onBack={() => {
        // @NOTE This route is reachable from the sign-in form and by direct
        // link (the email's reset link lands here), so "back" is wherever they
        // came from — the account entry when that is nowhere.
        if (router.history.canGoBack()) router.history.back()
        else router.navigate({ to: '/account', replace: true })
      }}
    />
  )
}

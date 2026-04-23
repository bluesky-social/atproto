import { createRoute, useRouter } from '@tanstack/react-router'
import { ErrorView } from '#/components/error-view'
import { ResetPasswordView } from '#/components/reset-password-view'
import { useSessionContext } from '#/contexts/session'
import { RootRoute } from '#/routes/account.tsx'

export const Route = createRoute({
  getParentRoute: () => RootRoute,
  path: '/account/reset-password',
  component: Page,
  errorComponent: ErrorView,
})

export function Page() {
  const { doInitiatePasswordReset, doConfirmResetPassword } =
    useSessionContext()

  const router = useRouter()

  return (
    <ResetPasswordView
      onResetPasswordRequest={doInitiatePasswordReset}
      onResetPasswordConfirm={doConfirmResetPassword}
      onBack={() => {
        // Try to send them back to wherever they came from
        window.history.back()

        // If they didn't move, send them to the account page
        setTimeout(() => {
          if (router.state.location.pathname === '/account/reset-password') {
            router.navigate({ to: '/account' })
          }
        }, 1_000)
      }}
    />
  )
}

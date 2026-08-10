import { useRouter } from '@tanstack/react-router'
import { ResetPasswordView } from '#/components/reset-password-view'
import { useSessionContext } from '#/contexts/session'

export default function Page() {
  const { api } = useSessionContext()

  const router = useRouter()

  return (
    <ResetPasswordView
      onResetPasswordRequest={async (data) => api.initiatePasswordReset(data)}
      onResetPasswordConfirm={async (data) => api.confirmResetPassword(data)}
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

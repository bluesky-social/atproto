import { Trans } from '@lingui/react/macro'
import { UpdatePasswordView } from '#/components/update-password-view.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useResetPasswordConfirm,
  useResetPasswordRequest,
} from '#/data/password.ts'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { email } = account

  const resetPasswordRequest = useResetPasswordRequest()
  const resetPasswordConfirm = useResetPasswordConfirm()

  if (!email) {
    return (
      <Admonition role="status">
        <Trans context="PasswordReset">
          No email associated with this account. Password reset is unavailable.
        </Trans>
      </Admonition>
    )
  }

  return (
    <UpdatePasswordView
      email={email}
      requestPending={resetPasswordRequest.isPending}
      onRequest={async () => {
        await resetPasswordRequest.mutateAsync({ email })
      }}
      confirmPending={resetPasswordConfirm.isPending}
      onConfirm={async ({ token, password }) => {
        await resetPasswordConfirm.mutateAsync({ token, password })
      }}
    />
  )
}

import { Trans } from '@lingui/react/macro'
import { useRouter } from '@tanstack/react-router'
import { Admonition } from '#/components/utils/admonition.tsx'
import { VerifyEmailView } from '#/components/verify-email-view.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useVerifyEmailConfirm, useVerifyEmailRequest } from '#/data/email'
export function Page() {
  const { account } = useAuthenticatedSession()
  const { email, sub } = account
  const { navigate } = useRouter()

  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  if (!email) {
    return (
      <Admonition role="status">
        <Trans context="EmailChange">
          No email associated with this account.
        </Trans>
      </Admonition>
    )
  }

  return (
    <VerifyEmailView
      email={email}
      requestPending={verifyRequest.isPending}
      confirmPending={verifyConfirm.isPending}
      onRequest={async () => {
        await verifyRequest.mutateAsync({ sub })
      }}
      onConfirm={async ({ token }) => {
        await verifyConfirm.mutateAsync({ sub, token, email })
      }}
      onCancel={() => navigate({ to: '/account' })}
      onDone={() => navigate({ to: '/account' })}
    />
  )
}

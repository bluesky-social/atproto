import { Trans } from '@lingui/react/macro'
import { useSearch } from '@tanstack/react-router'
import {
  UpdateEmailView,
  UpdateEmailViewState,
} from '#/components/update-email-view.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useUpdateEmailConfirm,
  useUpdateEmailRequest,
  useVerifyEmailConfirm,
  useVerifyEmailRequest,
} from '#/data/email'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { email, sub, email_verified } = account

  const updateRequest = useUpdateEmailRequest()
  const updateConfirm = useUpdateEmailConfirm()
  const verifyRequest = useVerifyEmailRequest()
  const verifyConfirm = useVerifyEmailConfirm()

  const search = useSearch({ strict: false }) as { screen?: string }
  const verifyRequested = search.screen === 'verify'

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
    <UpdateEmailView
      email={email}
      initialState={verifyRequested ? UpdateEmailViewState.Verify : undefined}
      emailVerified={email_verified}
      requestPending={updateRequest.isPending}
      confirmPending={updateConfirm.isPending}
      verifyRequestPending={verifyRequest.isPending}
      verifyConfirmPending={verifyConfirm.isPending}
      onRequest={async () => {
        await updateRequest.mutateAsync({ sub })
      }}
      onConfirm={async ({ email, token }) => {
        await updateConfirm.mutateAsync({ sub, token, email })
      }}
      onVerifyRequest={async () => {
        await verifyRequest.mutateAsync({ sub })
      }}
      onVerifyConfirm={async ({ email, token }) => {
        await verifyConfirm.mutateAsync({ sub, token, email })
      }}
    />
  )
}

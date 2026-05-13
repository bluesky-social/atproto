import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { UpdateEmailView } from '#/components/update-email-view.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { VerifyEmailView } from '#/components/verify-email-view.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import {
  useChangeEmailRequest,
  useUpdateEmailConfirm,
  useVerifyEmailConfirm,
  useVerifyEmailRequest,
} from '#/data/email'

enum View {
  Status,
  Verify,
  Update,
}

export function Page() {
  const { account } = useAuthenticatedSession()
  const { email, email_verified, sub } = account
  const [view, setView] = useState<View>(View.Status)

  const changeRequest = useChangeEmailRequest()
  const updateConfirm = useUpdateEmailConfirm()
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

  if (view === View.Verify) {
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
        onCancel={() => setView(View.Status)}
        onDone={() => setView(View.Status)}
      />
    )
  }

  if (view === View.Update) {
    return (
      <UpdateEmailView
        email={email}
        requestPending={changeRequest.isPending}
        confirmPending={updateConfirm.isPending}
        verifyRequestPending={verifyRequest.isPending}
        verifyConfirmPending={verifyConfirm.isPending}
        onRequest={async () => {
          await changeRequest.mutateAsync({ sub })
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
        onDone={() => setView(View.Status)}
      />
    )
  }

  return (
    <EmailStatus
      email={email}
      emailVerified={email_verified === true}
      onVerify={() => setView(View.Verify)}
      onUpdate={() => setView(View.Update)}
    />
  )
}

function EmailStatus({
  email,
  emailVerified,
  onVerify,
  onUpdate,
}: {
  email: string
  emailVerified: boolean
  onVerify: () => void
  onUpdate: () => void
}) {
  return (
    <div className="space-y-4">
      {emailVerified ? (
        <Admonition role="note" variant="success">
          <Trans context="EmailVerify">
            <strong>{email}</strong> is verified.
          </Trans>
        </Admonition>
      ) : (
        <Admonition
          role="status"
          variant="warning"
          title={<Trans context="EmailVerify">Email not verified</Trans>}
          action={
            <Button color="warning" size="sm" onClick={onVerify}>
              <Trans context="EmailVerify">Verify</Trans>
            </Button>
          }
        >
          <Trans context="EmailVerify">
            <strong>{email}</strong> has not been verified yet.
          </Trans>
        </Admonition>
      )}

      <div className="flex">
        <Button onClick={onUpdate}>
          <Trans context="EmailChange">Change email address</Trans>
        </Button>
      </div>
    </div>
  )
}

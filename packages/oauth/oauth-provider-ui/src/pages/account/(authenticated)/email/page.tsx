import { Trans } from '@lingui/react/macro'
import { useState } from 'react'
import { ButtonRequestReset } from '#/components/forms/button-request-reset'
import { ResetEmailConfirmForm } from '#/components/reset-email-confirm-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useChangeEmailRequest, useUpdateEmailConfirm } from '#/data/email'

export function Page() {
  const [success, setSuccess] = useState(false)
  const { account } = useAuthenticatedSession()

  const { email } = account
  if (!email) {
    return (
      <Admonition role="status">
        <Trans context="EmailChange">
          No email associated with this account.
        </Trans>
      </Admonition>
    )
  }

  const request = useChangeEmailRequest()
  const confirm = useUpdateEmailConfirm()

  return (
    <div className="space-y-4">
      <p>
        <Trans context="EmailChange">
          To change your email, we'll send a verification code to{' '}
          <strong>{email}</strong>. Enter the code below to set a new email.
        </Trans>
      </p>

      <ButtonRequestReset
        action={async () => request.mutateAsync()}
        loading={request.isPending}
        disabled={success}
        className="max-w-full"
      />

      <ResetEmailConfirmForm
        disabled={success || confirm.isPending}
        onSubmit={async (data) => {
          await confirm.mutateAsync(data)
          setSuccess(true)
        }}
      />
    </div>
  )
}

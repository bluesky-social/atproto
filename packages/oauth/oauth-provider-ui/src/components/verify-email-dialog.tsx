import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useEffect, useState } from 'react'
import { ButtonRequestCode } from '#/components/forms/button-request-code.tsx'
import { Button } from '#/components/forms/button.tsx'
import { VerifyEmailConfirmForm } from '#/components/verify-email-confirm-form.tsx'
import { DialogSimple } from './dialog-simple.tsx'

export type VerifyEmailDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: { token: string }) => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

enum VerifyEmailDialogState {
  Request,
  Confirm,
}

export function VerifyEmailDialog({
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  children,
}: VerifyEmailDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<VerifyEmailDialogState>(
    VerifyEmailDialogState.Request,
  )

  useEffect(() => {
    if (!open) setState(VerifyEmailDialogState.Request)
  }, [open])

  return (
    <DialogSimple
      trigger={children}
      title={t`Verify your email`}
      open={open}
      onOpenChange={setOpen}
    >
      {state === VerifyEmailDialogState.Request ? (
        <div className="align-stretch flex flex-col gap-4">
          <p>
            <Trans>
              To verify your email, we'll send a verification code to{' '}
              <strong>{email}</strong>.
            </Trans>
          </p>

          <ButtonRequestCode
            action={async () => {
              await onRequest()
              setState(VerifyEmailDialogState.Confirm)
            }}
            loading={requestPending}
            disabled={confirmPending}
            color="primary"
            className="w-full"
          >
            <Trans>Request code</Trans>
          </ButtonRequestCode>

          <Button
            onClick={() => setState(VerifyEmailDialogState.Confirm)}
            className="w-full"
          >
            <Trans>Already have a code?</Trans>
          </Button>
        </div>
      ) : (
        <VerifyEmailConfirmForm
          disabled={confirmPending}
          submitLabel={<Trans>Verify email</Trans>}
          onSubmit={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        >
          <p>
            <Trans>
              Please enter the code you received to verify your email address.
            </Trans>
          </p>
        </VerifyEmailConfirmForm>
      )}
    </DialogSimple>
  )
}

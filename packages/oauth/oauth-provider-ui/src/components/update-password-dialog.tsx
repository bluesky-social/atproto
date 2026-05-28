import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode, useEffect, useState } from 'react'
import { ButtonRequestCode } from '#/components/forms/button-request-code'
import { Button } from '#/components/forms/button.tsx'
import { ResetPasswordConfirmForm } from '#/components/reset-password-confirm-form.tsx'
import { DialogSimple } from './dialog-simple.tsx'

export type UpdatePasswordDialogProps = {
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: {
    token: string
    password: string
  }) => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

enum UpdatePasswordDialogState {
  Request,
  Confirm,
}

export function UpdatePasswordDialog({
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  children,
}: UpdatePasswordDialogProps) {
  const { t } = useLingui()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<UpdatePasswordDialogState>(
    UpdatePasswordDialogState.Request,
  )

  useEffect(() => {
    if (!open) setState(UpdatePasswordDialogState.Request)
  }, [open])

  return (
    <DialogSimple
      trigger={children}
      title={t`Change your password`}
      open={open}
      onOpenChange={setOpen}
    >
      {state === UpdatePasswordDialogState.Request ? (
        <div className="align-stretch flex flex-col gap-4">
          <p>
            <Trans>
              If you want to change your password, we will send you a code to
              verify that this is your account.
            </Trans>
          </p>

          <ButtonRequestCode
            action={async () => {
              await onRequest()
              setState(UpdatePasswordDialogState.Confirm)
            }}
            loading={requestPending}
            disabled={confirmPending}
            color="primary"
            className="w-full"
          />

          <Button
            onClick={() => setState(UpdatePasswordDialogState.Confirm)}
            className="w-full"
          >
            <Trans>Already have a code?</Trans>
          </Button>
        </div>
      ) : (
        <ResetPasswordConfirmForm
          disabled={confirmPending}
          onSubmit={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        >
          <p>
            <Trans>
              Please enter the code you received and the new password you would
              like to use.
            </Trans>
          </p>
        </ResetPasswordConfirmForm>
      )}
    </DialogSimple>
  )
}

import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { RequestCodeButton } from '#/components/forms/request-code-button.tsx'
import { ResetPasswordConfirmForm } from '#/components/reset-password-confirm-form.tsx'
import { Button } from '#/components/ui/button.tsx'

export type UpdatePasswordDialogProps = {
  email: string
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
  email,
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
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setState(UpdatePasswordDialogState.Request)
  }, [open])

  const dismissable = !requestPending && !confirmSubmitting

  return (
    <DialogShell
      trigger={children as ReactElement}
      title={t`Change your password`}
      description={
        <Trans>
          To change your password, you'll need to enter a security code sent to
          your email.
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
    >
      {state === UpdatePasswordDialogState.Request ? (
        <div className="align-stretch flex flex-col gap-4">
          <RequestCodeButton
            action={async () => {
              await onRequest()
              setState(UpdatePasswordDialogState.Confirm)
            }}
            disabled={confirmPending}
            variant="default"
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
          email={email}
          disabled={confirmPending}
          onLoadingChange={setConfirmSubmitting}
          onResend={onRequest}
          handler={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        />
      )}
    </DialogShell>
  )
}

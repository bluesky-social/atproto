import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactElement, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { actionRow } from '#/components/forms/form-shell.tsx'
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
  children: ReactElement
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
      trigger={children}
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
      {/* @NOTE Sending the code is the main path; "Already have a code?" is the
        escape hatch, so it is `ghost` — as `ResetPasswordView` treats the same
        string. `RequestCodeButton` defaults to `size="sm"` for the inline
        resend, so the size is restated here to match the button below. */}
      {state === UpdatePasswordDialogState.Request ? (
        <div className={actionRow}>
          <RequestCodeButton
            action={async () => {
              await onRequest()
              setState(UpdatePasswordDialogState.Confirm)
            }}
            disabled={confirmPending}
            variant="default"
            size="default"
            className="w-full sm:w-auto"
          />

          <Button
            variant="ghost"
            onClick={() => setState(UpdatePasswordDialogState.Confirm)}
            className="w-full sm:w-auto"
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

import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactElement, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { ActionButton } from '#/components/forms/form-shell.tsx'
import { RateLimitedForm } from '#/components/forms/rate-limited-form.tsx'
import {
  type ResetPasswordConfirmData,
  ResetPasswordConfirmForm,
} from '#/components/reset-password-confirm-form.tsx'

export type UpdatePasswordDialogProps = {
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: (data: { hcaptchaToken?: string }) => void | PromiseLike<void>
  onConfirm: (data: ResetPasswordConfirmData) => void | PromiseLike<void>
  children: ReactElement
  /** For password managers */
  currentUsername?: string
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
  currentUsername,
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
        string. Both requests may require a captcha (see the server's rate
        limits), so each goes through a `RateLimitedForm`: there is no inline
        resend, which could not show a challenge, "Back" leads to the request
        instead. */}
      {state === UpdatePasswordDialogState.Request ? (
        <RateLimitedForm
          submitLabel={<Trans>Send verification code</Trans>}
          disabled={confirmPending}
          handler={async ({ hcaptchaToken }) => {
            await onRequest({ hcaptchaToken })
            setState(UpdatePasswordDialogState.Confirm)
          }}
          actions={
            <ActionButton
              type="button"
              variant="ghost"
              onClick={() => setState(UpdatePasswordDialogState.Confirm)}
            >
              <Trans>Already have a code?</Trans>
            </ActionButton>
          }
        />
      ) : (
        <ResetPasswordConfirmForm
          currentUsername={currentUsername}
          disabled={confirmPending}
          onLoadingChange={setConfirmSubmitting}
          onBack={() => setState(UpdatePasswordDialogState.Request)}
          handler={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
        />
      )}
    </DialogShell>
  )
}

import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactElement, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { actionRow } from '#/components/forms/form-shell.tsx'
import { RequestCodeButton } from '#/components/forms/request-code-button.tsx'
import { Button } from '#/components/ui/button.tsx'
import { VerifyEmailConfirmForm } from '#/components/verify-email-confirm-form.tsx'

export type VerifyEmailDialogProps = {
  email: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: { token: string }) => void | PromiseLike<void>
  children: ReactElement
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
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setState(VerifyEmailDialogState.Request)
  }, [open])

  const dismissable = !requestPending && !confirmSubmitting

  return (
    <DialogShell
      trigger={children}
      title={t`Verify your email`}
      description={
        <Trans>
          To verify your email, you'll need to enter a security code sent to{' '}
          <strong className="break-words">{email}</strong>.
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
    >
      {/* @NOTE Actions rather than destinations, so these are `Button`s and
        not an option list: sending the code is the main path, "Already have a
        code?" the escape hatch. `RequestCodeButton` defaults to `size="sm"` for
        the inline resend; as a primary dialog action it takes the default. */}
      {state === VerifyEmailDialogState.Request ? (
        <div className={actionRow}>
          <RequestCodeButton
            action={async () => {
              await onRequest()
              setState(VerifyEmailDialogState.Confirm)
            }}
            disabled={requestPending || confirmPending}
            variant="default"
            size="default"
            className="w-full sm:w-auto"
          />

          <Button
            variant="ghost"
            onClick={() => setState(VerifyEmailDialogState.Confirm)}
            className="w-full sm:w-auto"
          >
            <Trans>Already have a code?</Trans>
          </Button>
        </div>
      ) : (
        <VerifyEmailConfirmForm
          disabled={confirmPending}
          onLoadingChange={setConfirmSubmitting}
          handler={async (data) => {
            await onConfirm(data)
            setOpen(false)
          }}
          onResend={onRequest}
        />
      )}
    </DialogShell>
  )
}

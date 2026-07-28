import { Trans, useLingui } from '@lingui/react/macro'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { RequestCodeButton } from '#/components/forms/request-code-button.tsx'
import { Button } from '#/components/ui/button.tsx'
import { VerifyEmailConfirmForm } from '#/components/verify-email-confirm-form.tsx'

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
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  useEffect(() => {
    if (!open) setState(VerifyEmailDialogState.Request)
  }, [open])

  const dismissable = !requestPending && !confirmSubmitting

  return (
    <DialogShell
      trigger={children as ReactElement}
      title={t`Verify your email`}
      description={
        <Trans>
          To verify your email, you'll need to enter a security code sent to{' '}
          <strong>{email}</strong>.
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
    >
      {/* @NOTE Unlike the username dialog's option list, these are actions
        rather than destinations, so they stay `Button`s. They do need a
        hierarchy though: sending the code is the main path, and "Already have a
        code?" is the escape hatch for someone returning with one. Both were
        `secondary` at the same weight.

        `RequestCodeButton` defaults to `size="sm"` for the inline resend in
        `TokenField`; here it is a primary dialog action, so it takes the
        default size and matches the button below it. */}
      {state === VerifyEmailDialogState.Request ? (
        <div className="align-stretch flex flex-col gap-2">
          <RequestCodeButton
            action={async () => {
              await onRequest()
              setState(VerifyEmailDialogState.Confirm)
            }}
            disabled={requestPending || confirmPending}
            variant="default"
            size="default"
            className="w-full"
          />

          <Button
            variant="ghost"
            onClick={() => setState(VerifyEmailDialogState.Confirm)}
            className="w-full"
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

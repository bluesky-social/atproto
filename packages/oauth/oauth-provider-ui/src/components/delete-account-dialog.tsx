import { Trans } from '@lingui/react/macro'
import { type ReactElement, useEffect, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Notice } from '#/components/feedback/notice.tsx'
import { actionRow } from '#/components/forms/form-shell.tsx'
import { RequestCodeButton } from '#/components/forms/request-code-button.tsx'
import { Button } from '#/components/ui/button.tsx'
import { useAsyncAction } from '#/hooks/use-async-action.ts'
import { DeleteAccountConfirmForm } from './delete-account-confirm-form.tsx'
import { Handle } from './utils/handle.tsx'

export type DeleteAccountDialogProps = {
  handle?: string
  email?: string
  requestPending?: boolean
  confirmPending?: boolean
  onRequest: () => void | PromiseLike<void>
  onConfirm: (data: {
    token: string
    password: string
  }) => void | PromiseLike<void>
  children: ReactElement
}

enum Step {
  Request,
  Confirm,
  FinalConfirm,
}

export function DeleteAccountDialog({
  handle,
  email,
  requestPending,
  confirmPending,
  onRequest,
  onConfirm,
  children,
}: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>(Step.Request)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [credentials, setCredentials] = useState<
    { token: string; password: string } | undefined
  >(undefined)

  const finalConfirm = useAsyncAction(
    async () => {
      if (!credentials) return
      try {
        await onConfirm(credentials)
        setOpen(false)
      } catch (err) {
        setCredentials(undefined)
        setStep(Step.Confirm)
        throw err
      }
    },
    { onLoadingChange: setConfirmSubmitting },
  )

  useEffect(() => {
    if (!open) {
      setStep(Step.Request)
      setCredentials(undefined)
      finalConfirm.reset()
    }
  }, [open, finalConfirm])

  const dismissable = !requestPending && !confirmSubmitting

  const title = handle ? (
    <Trans>
      Delete account <Handle handle={handle} />
    </Trans>
  ) : (
    <Trans>Delete account</Trans>
  )

  if (step === Step.FinalConfirm) {
    return (
      <DialogShell
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
        title={<Trans>Are you really, really sure?</Trans>}
        description={
          handle ? (
            <Trans>
              This will irreversibly delete your Bluesky account{' '}
              <Handle handle={handle} className="font-bold" /> and all
              associated data. Note that this will affect any other Atmosphere
              services you use with this account.
            </Trans>
          ) : (
            <Trans>
              This will irreversibly delete your Bluesky account and all
              associated data. Note that this will affect any other Atmosphere
              services you use with this account.
            </Trans>
          )
        }
      >
        <div className={actionRow}>
          <Button
            variant="destructive"
            disabled={finalConfirm.loading || confirmPending}
            onClick={() => void finalConfirm.run()}
            className="w-full sm:w-auto"
          >
            <Trans>Yes, delete my account</Trans>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={finalConfirm.loading || confirmPending}
            className="w-full sm:w-auto"
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </DialogShell>
    )
  }

  if (step === Step.Confirm) {
    return (
      <DialogShell
        trigger={children}
        open={open}
        onOpenChange={setOpen}
        dismissable={dismissable}
        title={title}
        description={
          email ? (
            <Trans>
              Check <strong className="break-words">{email}</strong> for an
              email with the confirmation code to enter below:
            </Trans>
          ) : (
            <Trans>
              Check your email for the confirmation code to enter below:
            </Trans>
          )
        }
      >
        <DeleteAccountConfirmForm
          email={email}
          // Disables the form while a code is being requested
          onResend={onRequest}
          onCancel={() => setOpen(false)}
          handler={async (data) => {
            setCredentials(data)
            setStep(Step.FinalConfirm)
          }}
        />
      </DialogShell>
    )
  }

  return (
    <DialogShell
      trigger={children}
      open={open}
      onOpenChange={setOpen}
      dismissable={dismissable}
      title={title}
      description={
        email ? (
          <Trans>
            For security reasons, we'll need to send a confirmation code to your
            email address <strong className="break-words">{email}</strong>.
          </Trans>
        ) : (
          <Trans>
            For security reasons, we'll need to send a confirmation code to your
            email address.
          </Trans>
        )
      }
    >
      <div className="align-stretch flex flex-col gap-4">
        <Notice role="note" className="text-sm">
          <Trans>
            You can also temporarily deactivate your account instead. Your
            profile, posts, feeds, and lists will no longer be visible to other
            Bluesky users. You can reactivate your account at any time by
            logging in.
          </Trans>
        </Notice>

        {/* @NOTE `RequestCodeButton` defaults to `size="sm"` for the inline
          resend, so a primary dialog action restates the size. */}
        <div className={actionRow}>
          <RequestCodeButton
            action={async () => {
              await onRequest()
              setStep(Step.Confirm)
            }}
            disabled={confirmPending}
            variant="default"
            size="default"
            className="w-full sm:w-auto"
          >
            <Trans>Send email</Trans>
          </RequestCodeButton>

          <Button
            variant="secondary"
            onClick={() => setOpen(false)}
            disabled={requestPending}
            className="w-full sm:w-auto"
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </div>
    </DialogShell>
  )
}

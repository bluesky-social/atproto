import { Trans } from '@lingui/react/macro'
import { type ReactElement, useState } from 'react'
import { ConfirmForm } from '#/components/dialogs/confirm-form.tsx'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Notice } from '#/components/feedback/notice.tsx'

export type ReactivateAccountDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: ReactElement
}

export function ReactivateAccountDialog({
  onConfirm,
  children,
}: ReactivateAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogShell
      trigger={children}
      title={<Trans>Reactivate account</Trans>}
      description={
        <Trans>
          Your profile, posts, feeds, and lists will become visible again across
          the Atmosphere network — that includes the Bluesky app and any other
          Atmosphere app you use with this account.
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      <ConfirmForm
        submitVariant="default"
        submitLabel={<Trans>Reactivate</Trans>}
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
      >
        <Notice role="note" className="text-sm">
          <Trans>
            You can deactivate your account again at any time from this page.
          </Trans>
        </Notice>
      </ConfirmForm>
    </DialogShell>
  )
}

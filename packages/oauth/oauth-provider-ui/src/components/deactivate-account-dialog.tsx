import { Trans } from '@lingui/react/macro'
import { type ReactElement, useState } from 'react'
import { ConfirmForm } from '#/components/dialogs/confirm-form.tsx'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Notice } from '#/components/feedback/notice.tsx'

export type DeactivateAccountDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: ReactElement
}

export function DeactivateAccountDialog({
  onConfirm,
  children,
}: DeactivateAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogShell
      trigger={children}
      title={<Trans>Deactivate account</Trans>}
      description={
        <Trans>
          Your content (profile, posts, feeds, lists, etc.) will be hidden from
          the Bluesky app and across the Atmosphere network.
        </Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      <ConfirmForm
        submitVariant="destructive"
        submitLabel={<Trans>Yes, Deactivate</Trans>}
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
      >
        <>
          <Notice role="note" className="text-sm">
            <Trans>
              There is no time limit for account deactivation, come back any
              time.
            </Trans>
          </Notice>

          <Notice role="note" className="text-sm">
            <Trans>
              Every app currently connected to your account, as well as any "app
              passwords" you've created, will be revoked. You'll need to sign
              back in when you reactivate.
            </Trans>
          </Notice>

          <Notice role="warning" className="text-sm">
            <Trans>
              If you're trying to change your handle or email, do so before you
              deactivate.
            </Trans>
          </Notice>
        </>
      </ConfirmForm>
    </DialogShell>
  )
}

import { Trans } from '@lingui/react/macro'
import { type ReactElement, type ReactNode, useState } from 'react'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Notice } from '#/components/feedback/notice.tsx'
import { SmartForm } from '#/components/forms/smart-form.tsx'

export type ReactivateAccountDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

export function ReactivateAccountDialog({
  onConfirm,
  children,
}: ReactivateAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogShell
      trigger={children as ReactElement}
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
      <SmartForm
        submitColor="primary"
        submitLabel={<Trans>Reactivate</Trans>}
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        validate={() => ({})}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
        fields={() => (
          <Notice role="note" className="text-sm">
            <Trans>
              You can deactivate your account again at any time from this page.
            </Trans>
          </Notice>
        )}
      />
    </DialogShell>
  )
}

import { Trans } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import { SmartForm } from '#/components/forms/smart-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { DialogSimple } from '#/components/utils/dialog-simple.tsx'

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
    <DialogSimple
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
          <Admonition role="note" className="text-sm">
            <Trans>
              You can deactivate your account again at any time from this page.
            </Trans>
          </Admonition>
        )}
      />
    </DialogSimple>
  )
}

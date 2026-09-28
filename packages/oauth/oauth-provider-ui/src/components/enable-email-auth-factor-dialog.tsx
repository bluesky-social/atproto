import { Trans } from '@lingui/react/macro'
import { ShieldCheckIcon } from 'lucide-react'
import { type ReactElement, useState } from 'react'
import { ConfirmForm } from '#/components/dialogs/confirm-form.tsx'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'

export type EnableEmailAuthFactorDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: ReactElement
}

export function EnableEmailAuthFactorDialog({
  onConfirm,
  children,
}: EnableEmailAuthFactorDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogShell
      trigger={children}
      title={<Trans>Enable two-factor authentication</Trans>}
      description={
        <Trans>Require an email code to sign in to your account.</Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      {/* @NOTE No fields — `ConfirmForm` is `FormShell` with nothing but the
        action row, so the submit stays wired to the form's own pending and
        error state. The icon needs no sizing class: `Button` already sets the
        gap and sizes any unsized svg. */}
      <ConfirmForm
        submitLabel={
          <>
            <Trans>Enable</Trans>
            <ShieldCheckIcon aria-hidden />
          </>
        }
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
      />
    </DialogShell>
  )
}

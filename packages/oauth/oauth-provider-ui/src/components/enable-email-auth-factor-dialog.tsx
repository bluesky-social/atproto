import { Trans } from '@lingui/react/macro'
import { ShieldCheckIcon } from '@phosphor-icons/react'
import { type ReactNode, useState } from 'react'
import { SmartForm } from '#/components/forms/smart-form.tsx'
import { DialogSimple } from '#/components/utils/dialog-simple.tsx'

export type EnableEmailAuthFactorDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

export function EnableEmailAuthFactorDialog({
  onConfirm,
  children,
}: EnableEmailAuthFactorDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogSimple
      trigger={children}
      title={<Trans>Enable email 2FA</Trans>}
      description={
        <Trans>Require an email code to sign in to your account.</Trans>
      }
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      <SmartForm
        submitColor="primary"
        submitLabel={
          <>
            <Trans>Enable</Trans>
            <ShieldCheckIcon aria-hidden className="ml-1.5 size-5" />
          </>
        }
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        validate={() => ({})}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
        fields={() => null}
      />
    </DialogSimple>
  )
}

import { Trans } from '@lingui/react/macro'
import { ReactNode, useState } from 'react'
import { SmartForm } from '#/components/forms/smart-form.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { DialogSimple } from '#/components/utils/dialog-simple.tsx'

export type DeactivateAccountDialogProps = {
  onConfirm: () => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

export function DeactivateAccountDialog({
  onConfirm,
  children,
}: DeactivateAccountDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <DialogSimple
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
      <SmartForm
        submitColor="error"
        submitLabel={<Trans>Yes, Deactivate</Trans>}
        onCancel={() => setOpen(false)}
        onLoadingChange={setSubmitting}
        validate={() => ({})}
        handler={async () => {
          await onConfirm()
          setOpen(false)
        }}
        fields={() => (
          <>
            <Admonition role="note" className="text-sm">
              <Trans>
                There is no time limit for account deactivation, come back any
                time.
              </Trans>
            </Admonition>

            <Admonition role="note" className="text-sm">
              <Trans>
                Every app currently connected to your account, as well as any
                "app passwords" you've created, will be revoked. You'll need to
                sign back in when you reactivate.
              </Trans>
            </Admonition>

            <Admonition role="warning" className="text-sm">
              <Trans>
                If you're trying to change your handle or email, do so before
                you deactivate.
              </Trans>
            </Admonition>
          </>
        )}
      />
    </DialogSimple>
  )
}

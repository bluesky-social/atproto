import { Trans } from '@lingui/react/macro'
import { type ReactElement, type ReactNode, useState } from 'react'
import { ConfirmForm } from '#/components/dialogs/confirm-form.tsx'
import { DialogShell } from '#/components/dialogs/dialog-shell.tsx'
import { Button } from '#/components/ui/button.tsx'
import { ScopeDescription } from '#/components/utils/scope-description.tsx'

export type OAuthSessionDetailsDialogProps = {
  clientName: string
  clientIdentifier: string
  scope?: string
  onRevoke: () => void | PromiseLike<void>
  children: Exclude<ReactNode, false | null | undefined>
}

export function OAuthSessionDetailsDialog({
  clientName,
  clientIdentifier,
  scope,
  onRevoke,
  children,
}: OAuthSessionDetailsDialogProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const hasIdentityOnlyAccess = !scope || scope === 'atproto'

  return (
    <DialogShell
      trigger={children as ReactElement}
      title={clientName}
      description={clientIdentifier}
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      <ConfirmForm
        submitVariant="destructive"
        submitLabel={<Trans context="OAuthApp">Revoke access</Trans>}
        actions={
          <Button
            autoFocus
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            <Trans>Close</Trans>
          </Button>
        }
        onLoadingChange={setSubmitting}
        handler={async () => {
          await onRevoke()
          setOpen(false)
        }}
      >
        {hasIdentityOnlyAccess ? (
          <p>
            <Trans>
              This app can uniquely identify you through your account.
            </Trans>
          </p>
        ) : (
          <>
            <p>
              <Trans>
                This app has access to your account with the following
                permissions:
              </Trans>
            </p>
            <ScopeDescription scope={scope} />
          </>
        )}
      </ConfirmForm>
    </DialogShell>
  )
}

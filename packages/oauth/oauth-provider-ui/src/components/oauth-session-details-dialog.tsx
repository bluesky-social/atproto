import { Trans } from '@lingui/react/macro'
import { type ReactNode, useState } from 'react'
import { Button } from '#/components/forms/button.tsx'
import { SmartForm } from '#/components/forms/smart-form.tsx'
import { DialogSimple } from '#/components/utils/dialog-simple.tsx'
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
    <DialogSimple
      trigger={children}
      title={clientName}
      description={clientIdentifier}
      open={open}
      onOpenChange={setOpen}
      dismissable={!submitting}
    >
      <SmartForm
        submitColor="error"
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
        validate={() => ({})}
        handler={async () => {
          await onRevoke()
          setOpen(false)
        }}
        fields={() =>
          hasIdentityOnlyAccess ? (
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
          )
        }
      />
    </DialogSimple>
  )
}

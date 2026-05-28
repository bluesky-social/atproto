import { Trans } from '@lingui/react/macro'
import { Button } from '#/components/forms/button.tsx'
import { UpdateHandleDialog } from '#/components/update-handle-dialog.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { useUpdateHandle } from '#/data/handle.ts'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { sub, preferred_username: currentHandle } = account

  const updateHandle = useUpdateHandle()

  return (
    <p>
      <Trans context="Handle">
        Your username is <strong>@{currentHandle}</strong>.
      </Trans>
      <UpdateHandleDialog
        did={sub}
        currentHandle={currentHandle}
        domains={availableUserDomains}
        onSubmit={async ({ handle }) => {
          await updateHandle.mutateAsync({ sub, handle })
        }}
      >
        <Button>
          <Trans context="Handle">Update</Trans>
        </Button>
      </UpdateHandleDialog>
    </p>
  )
}

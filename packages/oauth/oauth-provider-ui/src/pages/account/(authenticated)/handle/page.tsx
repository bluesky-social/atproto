import { Trans } from '@lingui/react/macro'
import { UpdateHandleView } from '#/components/update-handle-view.tsx'
import { Admonition } from '#/components/utils/admonition.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { useUpdateHandle } from '#/data/handle'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { sub, preferred_username: currentHandle } = account

  const updateHandle = useUpdateHandle()

  if (!currentHandle) {
    return (
      <Admonition role="status">
        <Trans context="HandleChange">
          No username associated with this account.
        </Trans>
      </Admonition>
    )
  }

  return (
    <UpdateHandleView
      currentHandle={currentHandle}
      domains={availableUserDomains}
      pending={updateHandle.isPending}
      onSubmit={async ({ handle }) => {
        await updateHandle.mutateAsync({ sub, handle })
      }}
    />
  )
}

import { UpdateHandleView } from '#/components/update-handle-view.tsx'
import { useAuthenticatedSession } from '#/contexts/authentication.tsx'
import { useCustomizationData } from '#/contexts/customization.tsx'
import { useUpdateHandle } from '#/data/handle'

export function Page() {
  const { account } = useAuthenticatedSession()
  const { availableUserDomains = [] } = useCustomizationData()
  const { sub, preferred_username: currentHandle } = account

  const updateHandle = useUpdateHandle()

  return (
    <UpdateHandleView
      did={sub}
      currentHandle={currentHandle}
      domains={availableUserDomains}
      pending={updateHandle.isPending}
      onSubmit={async ({ handle }) => {
        await updateHandle.mutateAsync({ sub, handle })
      }}
    />
  )
}

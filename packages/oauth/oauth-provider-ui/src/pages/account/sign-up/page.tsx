import { useNavigate } from '@tanstack/react-router'
import { SignUpView } from '#/components/sign-up-view.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

export default function Page() {
  const { api } = useSessionContext()
  const navigate = useNavigate()
  return (
    <SignUpView
      onValidateNewHandle={async (data) => {
        await api.validateHandleAvailability(data)
      }}
      onBack={() => navigate({ to: '/account/sign-in' })}
      onDone={async (data) => {
        const { account } = await api.signUp(data)
        // Sign-up establishes a session; go straight into its manager.
        navigate({
          to: '/account/u/$accountId',
          params: { accountId: account.handle ?? account.did },
          replace: true,
        })
      }}
    />
  )
}

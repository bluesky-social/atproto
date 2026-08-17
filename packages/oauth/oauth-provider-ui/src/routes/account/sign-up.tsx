import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { SignUpView } from '#/components/sign-up-view.tsx'
import { useSessionContext } from '#/contexts/session.tsx'

export const Route = createFileRoute('/account/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
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

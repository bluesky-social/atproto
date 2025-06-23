import { useSignedInContext } from '../auth/auth-provider.tsx'
import { ifString } from '../lib/util.ts'
import { useGetActorProfileQuery } from '../queries/use-get-actor-profile-query.ts'
import { useGetSessionQuery } from '../queries/use-get-session-query.ts'
import { ButtonDropdown } from './button-dropdown.tsx'

export function UserMenu() {
  const { agent, signOut } = useSignedInContext()
  const { data: profile, isLoading: profileLoading } = useGetActorProfileQuery()
  const { data: session, isLoading: sessionLoading } = useGetSessionQuery()

  const displayName = ifString(profile?.value?.displayName)
  const did = agent.assertDid
  const handle = session?.handle

  return (
    <ButtonDropdown
      transparent
      aria-label="User menu"
      menu={[
        {
          label: handle && <b>{handle}</b>,
          items: [
            {
              label: did,
              onClick: () => {
                navigator.clipboard.writeText(did)
              },
            },
            {
              label: 'Profile',
              onClick: () => {
                window.open(`https://bsky.app/profile/${did}`, '_blank')
              },
            },
          ],
        },
        {
          label: 'Sign out',
          onClick: signOut,
        },
      ]}
    >
      {displayName ||
        (profileLoading
          ? null
          : displayName || handle || (sessionLoading ? null : handle || did))}
    </ButtonDropdown>
  )
}

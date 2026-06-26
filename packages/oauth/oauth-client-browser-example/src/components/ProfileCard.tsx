import { JSX } from 'react'
import { DidString } from '@atproto/lex'
import { app } from '../lexicons.ts'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'

export type ProfileCardProps = JSX.IntrinsicElements['div'] & {
  actor: DidString
}

export function ProfileCard({
  className = '',
  children,
  actor,
  ...props
}: ProfileCardProps) {
  // Getting a user's profile from the Bluesky API
  const client = useBskyClient()
  const profileQuery = useLexQuery(client, app.bsky.actor.getProfile, { actor })
  const profileData = profileQuery.data?.body

  return (
    <div className={`overflow-hidden ${className}`} {...props}>
      {profileData?.banner && (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={profileData?.banner}
            alt="Banner"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {(profileData?.avatar ||
        profileData?.displayName ||
        profileData?.description) && (
        <div className="relative p-4">
          {profileData?.avatar && (
            <img
              src={profileData?.avatar}
              alt={profileData?.displayName || 'Avatar'}
              className="absolute -top-12 left-4 h-24 w-24 rounded-full border-4 border-white bg-white object-cover"
            />
          )}
          <div className="ml-28">
            <h2 className="text-2xl font-bold">{profileData?.displayName}</h2>
            {profileData?.pronouns && (
              <p className="text-sm text-gray-500">{profileData?.pronouns}</p>
            )}
            {profileData?.description && (
              <p className="mt-2">{profileData?.description}</p>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

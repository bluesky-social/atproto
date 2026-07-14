import type { JSX } from 'react'
import type { DidString } from '@atproto/lex'
import { app } from '../lexicons.ts'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'

export type ProfileCardProps = JSX.IntrinsicElements['div'] & {
  actor: DidString
}

export function ProfileCard({
  actor,

  // div
  children,
  className = '',
  ...props
}: ProfileCardProps) {
  // Getting a user's profile from the Bluesky API
  const client = useBskyClient()
  const profileQuery = useLexQuery(
    client,
    app.bsky.actor.getProfile,
    { actor },
    { refetchOnWindowFocus: true },
  )
  const profileData = profileQuery.data?.body

  return (
    <div
      className={`rounded-md bg-white text-slate-900 shadow-md dark:bg-slate-900 dark:text-slate-100 ${className}`}
      {...props}
    >
      {profileData?.banner && (
        <div className="h-32 w-full overflow-hidden rounded-t-md">
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
              className="absolute -top-12 left-4 h-24 w-24 rounded-full border-4 border-white bg-white object-cover dark:border-slate-900 dark:bg-slate-900"
            />
          )}
          <div>
            {profileData?.displayName && (
              <h2
                className={`text-2xl font-bold ${profileData?.avatar ? 'ml-28' : undefined}`}
              >
                {profileData?.displayName}
              </h2>
            )}
            {profileData?.description && (
              <p
                className={`mt-2 ${profileData?.avatar && !profileData?.displayName ? 'ml-28' : undefined}`}
              >
                {profileData?.description}
              </p>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

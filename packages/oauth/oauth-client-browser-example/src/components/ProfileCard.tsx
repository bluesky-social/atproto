import type { JSX, ReactNode } from 'react'
import type { DidString } from '@atproto/lex'
import { app } from '../lexicons.ts'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { Placeholder } from './Placeholder.tsx'

export type ProfileCardProps = JSX.IntrinsicElements['div'] & {
  actor: DidString
}

export function ProfileCard({
  actor,
  // div
  ...props
}: ProfileCardProps) {
  // Getting a user's profile from the Bluesky API
  const client = useBskyClient()
  const profileQuery = useLexQuery(
    client,
    app.bsky.actor.getProfile,
    { actor },
    { refetchOnWindowFocus: true, refetchOnReconnect: true },
  )

  const profileData = profileQuery.data?.body
  if (!profileData) {
    return (
      <ProfileCardLayout
        {...props}
        banner={<Placeholder className="h-full w-full" />}
        avatar={<Placeholder className="h-full w-full" />}
        name={<Placeholder className="h-[1em] w-36 rounded" />}
        description={
          <>
            <Placeholder className="h-[1em] w-full rounded" />
            <Placeholder className="mt-2 h-[1em] w-full rounded" />
          </>
        }
      />
    )
  }

  return (
    <ProfileCardLayout
      {...props}
      banner={
        profileData.banner && (
          <img
            src={profileData.banner}
            alt="Banner"
            className="h-full w-full object-cover"
          />
        )
      }
      avatar={
        profileData.avatar && (
          <img
            src={profileData.avatar}
            alt={profileData.displayName || 'Avatar'}
            className="h-full w-full object-cover"
          />
        )
      }
      name={profileData.displayName}
      description={profileData.description}
    />
  )
}

type ProfileCardLayoutProps = JSX.IntrinsicElements['div'] & {
  avatar?: ReactNode
  banner?: ReactNode
  name?: ReactNode
  description?: ReactNode
}

function ProfileCardLayout({
  avatar,
  banner,
  name,
  description,

  // div
  children,
  ...props
}: ProfileCardLayoutProps) {
  return (
    <div {...props}>
      {banner && (
        <div className="h-32 w-full overflow-hidden rounded-t-md">{banner}</div>
      )}
      {(avatar || name || description) && (
        <div className="relative p-4">
          {avatar && (
            <div className="absolute -top-12 left-4 h-24 w-24 overflow-hidden rounded-full border-4 border-white bg-white object-cover dark:border-slate-900 dark:bg-slate-900">
              {avatar}
            </div>
          )}
          <div>
            {name && (
              <h2
                className={`text-2xl font-bold ${avatar ? 'ml-28' : undefined}`}
              >
                {name}
              </h2>
            )}
            {description && (
              <p className={`mt-4 ${avatar && !name ? 'ml-28' : undefined}`}>
                {description}
              </p>
            )}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

import { JSX, useMemo } from 'react'
import { l } from '@atproto/lex'
import { app, com } from '../lexicons.ts'
import { useBlobUrl } from '../lib/use-blob-url.ts'
import { useBskyClient } from '../providers/BskyClientProvider.tsx'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { useLexRecord } from '../queries/use-lex-record.ts'

export type ProfileInfoProps = JSX.IntrinsicElements['div']

export function ProfileInfo({
  className = '',
  children,
  ...props
}: ProfileInfoProps) {
  // @NOTE for more detailed profile info, we should be using the
  // app.bsky.actor.getProfile query. This example uses the record for
  // demonstration purposes.
  const profileQuery = useLexRecord(app.bsky.actor.profile)

  const avatarUrl = useBlobRefUrl(profileQuery.data?.value?.avatar)
  const bannerUrl = useBlobRefUrl(profileQuery.data?.value?.banner)
  const displayName = profileQuery.data?.value?.displayName
  const description = profileQuery.data?.value?.description
  const pronouns = profileQuery.data?.value?.pronouns

  return (
    <div className={`overflow-hidden ${className}`} {...props}>
      {bannerUrl && (
        <div className="h-32 w-full overflow-hidden">
          <img
            src={bannerUrl}
            alt="Banner"
            className="h-full w-full object-cover"
          />
        </div>
      )}
      {(avatarUrl || displayName || description) && (
        <div className="relative p-4">
          {avatarUrl && (
            <img
              src={avatarUrl}
              alt={displayName || 'Avatar'}
              className="absolute -top-12 left-4 h-24 w-24 rounded-full border-4 border-white bg-white object-cover"
            />
          )}
          <div className="ml-28">
            <h2 className="text-2xl font-bold">{displayName}</h2>
            {pronouns && <p className="text-sm text-gray-500">{pronouns}</p>}
            {description && <p className="mt-2">{description}</p>}
          </div>
        </div>
      )}

      {children}
    </div>
  )
}

function useBlobRefUrl(ref: l.BlobRef | null | undefined) {
  const { did } = useBskyClient()
  const blobQuery = useLexQuery(
    com.atproto.sync.getBlob,
    did && ref ? { did, cid: ref.ref.toString() } : false,
  )
  const blob = useMemo(() => {
    return blobQuery.data
      ? new Blob([blobQuery.data.body], { type: blobQuery.data.encoding })
      : null
  }, [blobQuery.data])
  const url = useBlobUrl(blob)
  return url
}

import { Database } from '../../src/data-plane/server/db'
import { ids } from '../../src/data-plane/server/indexing/collections'
import feeds from '../../src/data-plane/server/routes/feeds'
import likes from '../../src/data-plane/server/routes/likes'
import posts from '../../src/data-plane/server/routes/posts'
import profile from '../../src/data-plane/server/routes/profile'
import { createTestDb } from '../indexing/helpers'

export { createTestDb }

const ts = '2026-01-01T00:00:00.000Z'
const cid = 'bafyreief577qr2nxcsmx5gi536ftridv6p7zfkd4w2oacyl5xvzqzp36fy'

export const createRouteHandlers = (db: Database) => ({
  ...feeds(db),
  ...profile(db),
  ...posts(db),
  ...likes(db),
})

export async function seedActor(
  db: Database,
  opts: {
    did: string
    handle?: string
    displayName?: string
    followersCount?: number
    postsCount?: number
    upstreamStatus?: string
  },
) {
  await db.db
    .insertInto('actor')
    .values({
      did: opts.did,
      handle: opts.handle ?? null,
      pdsEndpoint: 'https://pds.example.com',
      displayName: opts.displayName ?? null,
      description: null,
      avatarCid: null,
      bannerCid: null,
      followersCount: opts.followersCount ?? 0,
      postsCount: opts.postsCount ?? 0,
      upstreamStatus: opts.upstreamStatus ?? 'active',
      indexedAt: ts,
    })
    .execute()
}

export async function seedPost(
  db: Database,
  opts: {
    did: string
    rkey: string
    createdAt: string
    caption?: string
    likeCount?: number
  },
) {
  const uri = `at://${opts.did}/${ids.AppSokaaFeedPost}/${opts.rkey}`
  await db.db
    .insertInto('post')
    .values({
      uri,
      cid,
      creator: opts.did,
      caption: opts.caption ?? null,
      mediaType: 'video',
      mediaJson: { $type: ids.AppSokaaEmbedVideo },
      likeCount: opts.likeCount ?? 0,
      createdAt: opts.createdAt,
      indexedAt: ts,
    })
    .execute()
  return uri
}

export async function seedFollow(
  db: Database,
  opts: { creator: string; subjectDid: string; rkey: string },
) {
  await db.db
    .insertInto('follow')
    .values({
      uri: `at://${opts.creator}/${ids.AppSokaaGraphFollow}/${opts.rkey}`,
      creator: opts.creator,
      subjectDid: opts.subjectDid,
      createdAt: ts,
      indexedAt: ts,
    })
    .execute()
}

export async function seedLike(
  db: Database,
  opts: { creator: string; subjectUri: string; rkey: string },
) {
  await db.db
    .insertInto('like')
    .values({
      uri: `at://${opts.creator}/${ids.AppSokaaFeedLike}/${opts.rkey}`,
      creator: opts.creator,
      subject: opts.subjectUri,
      subjectCid: cid,
      createdAt: ts,
      indexedAt: ts,
    })
    .execute()
}

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestNetwork } from '@atproto/dev-env'

describe('data plane known likers', () => {
  let network: TestNetwork

  const viewer = 'did:plc:viewer'
  const subjectA = 'at://did:plc:author/app.bsky.feed.post/a'
  const subjectB = 'at://did:plc:author/app.bsky.feed.post/b'
  const cutoffSubject = 'at://did:plc:author/app.bsky.feed.post/cutoff'
  const missingSubject = 'at://did:plc:author/app.bsky.feed.post/missing'
  const known1 = 'did:plc:known1'
  const known2 = 'did:plc:known2'
  const known3 = 'did:plc:known3'
  const oldKnown = 'did:plc:old-known'
  const newKnown = 'did:plc:new-known'

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_known_likers',
    })

    const { db } = network.bsky.db
    const followedDids = [known1, known2, known3, oldKnown, newKnown]
    await db
      .insertInto('follow')
      .values(
        followedDids.map((did, i) => ({
          uri: `at://${viewer}/app.bsky.graph.follow/${i}`,
          cid: `follow-cid-${i}`,
          creator: viewer,
          subjectDid: did,
          createdAt: timestamp(i),
          indexedAt: timestamp(i),
        })),
      )
      .execute()

    const likes = [
      like(subjectA, known1, 1),
      like(subjectA, known2, 2),
      like(subjectA, 'did:plc:unknown', 3),
      like(subjectA, known3, 4),
      like(subjectB, known1, 5),
      like(subjectB, known2, 6),
      ...Array.from({ length: 501 }, (_, i) =>
        like(
          cutoffSubject,
          i === 0
            ? oldKnown
            : i === 500
              ? newKnown
              : `did:plc:cutoff-unknown-${i}`,
          100 + i,
        ),
      ),
    ]
    await db.insertInto('like').values(likes).execute()
  })

  afterAll(async () => network?.close())

  it('returns multiple subjects in input order', async () => {
    const { results } = await network.bsky.ctx.dataplane.getKnownLikers({
      actorDid: viewer,
      subjectUris: [subjectA, missingSubject, subjectB, subjectA],
      limit: 2,
    })

    expect(results).toEqual([
      { subjectUri: subjectA, count: 3, dids: [known3, known2] },
      { subjectUri: missingSubject, count: 0, dids: [] },
      { subjectUri: subjectB, count: 2, dids: [known2, known1] },
      { subjectUri: subjectA, count: 3, dids: [known3, known2] },
    ])
  })

  it('only considers the 500 most recent likes', async () => {
    const { results } = await network.bsky.ctx.dataplane.getKnownLikers({
      actorDid: viewer,
      subjectUris: [cutoffSubject],
      limit: 3,
    })

    expect(results).toEqual([
      { subjectUri: cutoffSubject, count: 1, dids: [newKnown] },
    ])
  })

  it('handles non-positive limits and empty subject lists', async () => {
    await expect(
      network.bsky.ctx.dataplane.getKnownLikers({
        actorDid: viewer,
        subjectUris: [subjectA],
        limit: 0,
      }),
    ).resolves.toEqual({
      results: [{ subjectUri: subjectA, count: 0, dids: [] }],
    })
    await expect(
      network.bsky.ctx.dataplane.getKnownLikers({
        actorDid: viewer,
        subjectUris: [],
        limit: 3,
      }),
    ).resolves.toEqual({ results: [] })
  })
})

function like(subject: string, creator: string, order: number) {
  return {
    uri: `at://${creator}/app.bsky.feed.like/${order}`,
    cid: `like-cid-${order}`,
    creator,
    subject,
    subjectCid: 'subject-cid',
    via: null,
    viaCid: null,
    createdAt: timestamp(order),
    indexedAt: timestamp(order),
  }
}

function timestamp(order: number) {
  return new Date(Date.UTC(2020, 0, 1, 0, 0, order)).toISOString()
}

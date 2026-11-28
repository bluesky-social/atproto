import type { TestBsky } from '../bsky.js'
import { EXAMPLE_LABELER } from '../const.js'
import type { TestNetworkNoAppView } from '../network-no-appview.js'
import { TestNetwork } from '../network.js'
import type { SeedClient } from './client.js'
import usersSeed from './users.js'

export default async function basicSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
  users = true,
) {
  if (users) await usersSeed(sc)

  const alice = sc.dids.alice
  const bob = sc.dids.bob
  const carol = sc.dids.carol
  const dan = sc.dids.dan
  const createdAtMicroseconds = () => ({
    createdAt: new Date().toISOString().replace('Z', '000Z'), // microseconds
  })
  const createdAtTimezone = () => ({
    createdAt: new Date().toISOString().replace('Z', '+00:00'), // iso timezone format
  })

  // @NOTE bsky's indexer can lose a count update (likes, reposts or replies of
  // a post, followers of an actor). After each commit it recounts in a
  // background task, with one `INSERT … VALUES ((SELECT count(*) …)) ON
  // CONFLICT DO UPDATE` whose count is read from the statement's start
  // snapshot. When two writes to the same count are indexed concurrently, as
  // commits from different DIDs are, the recount that missed the other write
  // can finish last (e.g. replyCount 1 with two replies). Until the indexer
  // serializes these recounts (`updateAggregates` in its indexing plugins),
  // the `processAll()` calls tagged "counts" index such writes one at a time.
  await sc.follow(alice, bob)
  await sc.follow(alice, carol)
  await sc.follow(alice, dan)
  await sc.follow(carol, alice)
  await sc.network.processAll() // counts: followers
  await sc.follow(bob, alice)
  await sc.follow(bob, carol, createdAtMicroseconds())
  await sc.follow(dan, bob, createdAtTimezone())
  await sc.post(alice, posts.alice[0], undefined, undefined, undefined, {
    labels: {
      $type: 'com.atproto.label.defs#selfLabels',
      values: [{ val: 'self-label' }],
    },
  })
  await sc.post(bob, posts.bob[0], undefined, undefined, undefined, {
    langs: ['en-US', 'i-klingon'],
  })
  const img1 = await sc.uploadFile(
    carol,
    '../dev-env/assets/key-landscape-small.jpg',
    'image/jpeg',
  )
  const img2 = await sc.uploadFile(
    carol,
    '../dev-env/assets/key-alt.jpg',
    'image/jpeg',
  )
  await sc.post(
    carol,
    posts.carol[0],
    undefined,
    [img1, img2], // Contains both images and a quote
    sc.posts[bob][0].ref,
  )
  await sc.post(dan, posts.dan[0])
  await sc.post(
    dan,
    posts.dan[1],
    [
      {
        index: { byteStart: 0, byteEnd: 18 },
        features: [
          {
            $type: `app.bsky.richtext.facet#mention`,
            did: alice,
          },
        ],
      },
    ],
    undefined,
    sc.posts[carol][0].ref, // This post contains an images embed
  )
  await sc.post(
    alice,
    posts.alice[1],
    undefined,
    undefined,
    undefined,
    createdAtMicroseconds(),
  )
  await sc.post(
    bob,
    posts.bob[1],
    undefined,
    undefined,
    undefined,
    createdAtTimezone(),
  )
  await sc.post(
    alice,
    posts.alice[2],
    undefined,
    undefined,
    sc.posts[dan][1].ref, // This post contains a record embed which contains an images embed
  )
  await sc.like(bob, sc.posts[alice][1].ref)
  await sc.like(bob, sc.posts[alice][2].ref)
  await sc.network.processAll() // counts: likes
  await sc.like(carol, sc.posts[alice][1].ref)
  await sc.like(carol, sc.posts[alice][2].ref)
  await sc.network.processAll() // counts: likes
  await sc.like(dan, sc.posts[alice][1].ref)
  await sc.like(alice, sc.posts[carol][0].ref, createdAtMicroseconds())
  await sc.network.processAll() // counts: likes
  await sc.like(bob, sc.posts[carol][0].ref, createdAtTimezone())

  const replyImg = await sc.uploadFile(
    bob,
    '../dev-env/assets/key-landscape-small.jpg',
    'image/jpeg',
  )
  // must ensure ordering of replies in indexing
  await sc.network.processAll()
  await sc.reply(
    bob,
    sc.posts[alice][1].ref,
    sc.posts[alice][1].ref,
    replies.bob[0],
    undefined,
    [replyImg],
  )
  await sc.network.processAll() // counts: replies
  await sc.reply(
    carol,
    sc.posts[alice][1].ref,
    sc.posts[alice][1].ref,
    replies.carol[0],
  )
  await sc.network.processAll()
  const alicesReplyToBob = await sc.reply(
    alice,
    sc.posts[alice][1].ref,
    sc.replies[bob][0].ref,
    replies.alice[0],
  )
  await sc.repost(carol, sc.posts[dan][1].ref)
  await sc.repost(dan, sc.posts[alice][1].ref)
  await sc.repost(dan, alicesReplyToBob.ref)

  if (sc.network instanceof TestNetwork) {
    const bsky = sc.network.bsky
    await createLabel(bsky, {
      val: 'test-label',
      uri: sc.posts[alice][2].ref.uriStr,
      cid: sc.posts[alice][2].ref.cidStr,
    })
    await createLabel(bsky, {
      val: 'test-label',
      uri: sc.replies[bob][0].ref.uriStr,
      cid: sc.replies[bob][0].ref.cidStr,
    })
    await createLabel(bsky, {
      val: 'test-label-2',
      uri: sc.replies[bob][0].ref.uriStr,
      cid: sc.replies[bob][0].ref.cidStr,
    })
  }

  return sc
}

export const posts = {
  alice: ['hey there', 'again', 'yoohoo label_me'],
  bob: ['bob back at it again!', 'bobby boy here', 'yoohoo'],
  carol: ['hi im carol'],
  dan: ['dan here!', '@alice.bluesky.xyz is the best'],
}

export const replies = {
  alice: ['thanks bob'],
  bob: ['hear that label_me label_me_2'],
  carol: ['of course'],
}

const createLabel = async (
  bsky: TestBsky,
  opts: { uri: string; cid: string; val: string },
) => {
  await bsky.db.db
    .insertInto('label')
    .values({
      uri: opts.uri,
      cid: opts.cid,
      val: opts.val,
      cts: new Date().toISOString(),
      neg: false,
      src: EXAMPLE_LABELER, // this did is also configured on labelsFromIssuerDids
    })
    .execute()
}

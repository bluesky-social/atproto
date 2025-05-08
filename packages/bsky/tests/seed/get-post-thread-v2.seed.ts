import { addHours, subHours } from 'date-fns'
import {
  RecordRef,
  SeedClient,
  TestNetwork,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import { createUsers } from './util'

// ignored so it's easier to read the seeds
// prettier-ignore
export async function simpleThreadSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'simple', [
    'op',
    'alice',
    'bob',
    'carol',
    'dan'
  ] as const)

  const p_0 = await sc.post(users.op.did, 'p_0 (op)')

  const p_0_0 = await sc.reply(users.op.did, p_0.ref, p_0.ref, 'p_0_0 (op)')
  const p_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0.ref, 'p_0_0_0 (op)')

  const p_0_1 = await sc.reply(users.alice.did, p_0.ref, p_0.ref, 'p_0_1 (alice)')
  const p_0_2 = await sc.reply(users.bob.did, p_0.ref, p_0.ref, 'p_0_2 (bob)')
  const p_0_3 = await sc.reply(users.carol.did, p_0.ref, p_0.ref, 'p_0_3 (carol)')

  const p_0_2_0 = await sc.reply(users.alice.did, p_0.ref, p_0_2.ref, 'p_0_2_0 (alice)')

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0,
      p_0_0,
      p_0_0_0,
      p_0_1,
      p_0_2,
      p_0_2_0,
      p_0_3,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function longThreadSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'long', [
    'op',
    'alice',
    'bob',
    'carol',
    'dan'
  ] as const)

  const p_0 = await sc.post(users.op.did, 'p_0 (op)')

  const p_0_0 = await sc.reply(users.op.did, p_0.ref, p_0.ref, 'p_0_0 (op)')
  const p_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0.ref, 'p_0_0_0 (op)')
  const p_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0.ref, 'p_0_0_0_0 (op)')
  const p_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0.ref, 'p_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0.ref, 'p_0_0_0_0_0_0 (op)')
  const p_0_0_0_1 = await sc.reply(users.op.did, p_0.ref, p_0_0_0.ref, 'p_0_0_0_1 (op)')

  const p_0_1 = await sc.reply(users.alice.did, p_0.ref, p_0.ref, 'p_0_1 (alice)')
  const p_0_2 = await sc.reply(users.bob.did, p_0.ref, p_0.ref, 'p_0_2 (bob)')
  const p_0_3 = await sc.reply(users.carol.did, p_0.ref, p_0.ref, 'p_0_3 (carol)')

  const p_0_4 = await sc.reply(users.op.did, p_0.ref, p_0.ref, 'p_0_4 (op)')
  const p_0_4_0 = await sc.reply(users.op.did, p_0.ref, p_0_4.ref, 'p_0_4_0 (op)')
  const p_0_4_0_0 = await sc.reply(users.alice.did, p_0.ref, p_0_4_0.ref, 'p_0_4_0_0 (alice)')
  const p_0_4_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_4_0_0.ref, 'p_0_4_0_0_0 (op)')
  const p_0_4_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_4_0_0_0.ref, 'p_0_4_0_0_0_0 (op)')

  const p_0_5 = await sc.reply(users.alice.did, p_0.ref, p_0.ref, 'p_0_5 (alice)')
  const p_0_6 = await sc.reply(users.bob.did, p_0.ref, p_0.ref, 'p_0_6 (bob)')
  const p_0_7 = await sc.reply(users.carol.did, p_0.ref, p_0.ref, 'p_0_7 (carol)')

  await sc.like(users.op.did, p_0_5.ref)
  await sc.like(users.bob.did, p_0_5.ref)
  await sc.like(users.carol.did, p_0_5.ref)
  await sc.like(users.dan.did, p_0_5.ref)

  await sc.like(users.op.did, p_0_6.ref)
  await sc.like(users.alice.did, p_0_6.ref)
  await sc.like(users.carol.did, p_0_6.ref)

  await sc.like(users.op.did, p_0_7.ref)
  await sc.like(users.bob.did, p_0_7.ref)

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0,
      p_0_0,
      p_0_0_0,
      p_0_0_0_0,
      p_0_0_0_0_0,
      p_0_0_0_0_0_0,
      p_0_0_0_1,
      p_0_1,
      p_0_2,
      p_0_3,
      p_0_4,
      p_0_4_0,
      p_0_4_0_0,
      p_0_4_0_0_0,
      p_0_4_0_0_0_0,
      p_0_5,
      p_0_6,
      p_0_7,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function deepThreadSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'deep', [
    'op',
    'alice',
    'bob',
    'carol',
    'dan'
  ] as const)

  const p_0 = await sc.post(users.op.did, 'p_0 (op)')
  const p_0_0 = await sc.reply(users.op.did, p_0.ref, p_0.ref, 'p_0_0 (op)')
  const p_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0.ref, 'p_0_0_0 (op)')
  const p_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0.ref, 'p_0_0_0_0 (op)')
  const p_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0.ref, 'p_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0.ref, 'p_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')
  const p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 = await sc.reply(users.op.did, p_0.ref, p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0.ref, 'p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0 (op)')

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0,
      p_0_0,
      p_0_0_0,
      p_0_0_0_0,
      p_0_0_0_0_0,
      p_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
      p_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0_0,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function threadViewSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'tv', [
    'op',
    'alice',
    'bob',
    'viewer',
  ] as const)

  const root = await sc.post(users.op.did, 'root')

  const root_a1 = await sc.reply(users.alice.did, root.ref, root.ref, 'root_a1') // deleted
  const root_a1_a2 = await sc.reply(users.alice.did, root.ref, root_a1.ref, 'root_a1_a2')
  const root_a1_a2_a3 = await sc.reply(users.alice.did, root.ref, root_a1_a2.ref, 'root_a1_a2_a3')

  const root_b1 = await sc.reply(users.bob.did, root.ref, root.ref, 'root_b1') // blocks viewer
  const root_b1_a1 = await sc.reply(users.alice.did, root.ref, root_b1.ref, 'root_b1_a1')

  await sc.deletePost(users.alice.did, root_a1.ref.uri)
  await sc.block(users.bob.did, users.viewer.did)

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      root,
      root_a1,
      root_a1_a2,
      root_a1_a2_a3,
      root_b1,
      root_b1_a1,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function annotateOPThreadSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'opthread', [
    'op',
    'alice',
    'bob',
  ] as const)

  const p_0_o = await sc.post(users.op.did, 'p_0_o')
  const p_0_0_o = await sc.reply(users.op.did, p_0_o.ref, p_0_o.ref, 'p_0_0_o') // thread
  const p_0_0_0_o = await sc.reply(users.op.did, p_0_o.ref, p_0_0_o.ref, 'p_0_0_0_o') // thread
  const p_0_0_0_0_o = await sc.reply(users.op.did, p_0_o.ref, p_0_0_0_o.ref, 'p_0_0_0_0_o') // thread
  const p_0_1_a = await sc.reply(users.alice.did, p_0_o.ref, p_0_o.ref, 'p_0_1_a')
  const p_0_1_0_a = await sc.reply(users.alice.did, p_0_o.ref, p_0_1_a.ref, 'p_0_1_0_a')
  const p_0_2_o = await sc.reply(users.op.did, p_0_o.ref, p_0_o.ref, 'p_0_2_o') // thread
  const p_0_2_0_b = await sc.reply(users.bob.did, p_0_o.ref, p_0_2_o.ref, 'p_0_2_0_b')
  const p_0_2_0_0_o = await sc.reply(users.op.did, p_0_o.ref, p_0_2_0_b.ref, 'p_0_2_0_0_o') // not thread

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0_o,
      p_0_0_o,
      p_0_0_0_o,
      p_0_0_0_0_o,
      p_0_1_a,
      p_0_1_0_a,
      p_0_2_o,
      p_0_2_0_b,
      p_0_2_0_0_o,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function threadSortingSeedNoOpOrViewerReplies(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'sort1', [
    'op',
    'alice',
    'bob',
    'carol',
  ] as const)

  const tenHoursAgo = subHours(new Date(), 10)
  const p_0_o = await sc.post(users.op.did, 'p_0_o', undefined, undefined, undefined, { createdAt: tenHoursAgo.toISOString()} )

  const reply = (user: string, parent: RecordRef, text: string, createdAt?: Date) => {
    return sc.reply(user, p_0_o.ref, parent, text, undefined, undefined, createdAt ? { createdAt: createdAt.toISOString()} : undefined)
  }

  const p_0_0_a = await reply(users.alice.did, p_0_o.ref, 'p_0_0_a', addHours(tenHoursAgo, 1)) // 0 likes
  const p_0_0_0_c = await reply(users.carol.did, p_0_0_a.ref, 'p_0_0_0_c', addHours(tenHoursAgo, 2)) // 0 likes
  const p_0_0_1_a = await reply(users.alice.did, p_0_0_a.ref, 'p_0_0_1_a', addHours(tenHoursAgo, 3)) // 2 likes
  const p_0_0_2_b = await reply(users.bob.did, p_0_0_a.ref, 'p_0_0_2_b', addHours(tenHoursAgo, 4)) // 1 like

  const p_0_1_c = await reply(users.carol.did, p_0_o.ref, 'p_0_1_c', addHours(tenHoursAgo, 3)) // 3 likes
  const p_0_1_0_b = await reply(users.bob.did, p_0_1_c.ref, 'p_0_1_0_b', addHours(tenHoursAgo, 4)) // 1 like
  const p_0_1_1_c = await reply(users.carol.did, p_0_1_c.ref, 'p_0_1_1_c', addHours(tenHoursAgo, 5)) // 2 likes
  const p_0_1_2_a = await reply(users.alice.did, p_0_1_c.ref, 'p_0_1_2_a', addHours(tenHoursAgo, 6)) // 0 likes

  const p_0_2_b = await reply(users.bob.did, p_0_o.ref, 'p_0_2_b', addHours(tenHoursAgo, 5)) // 2 likes
  const p_0_2_0_b = await reply(users.bob.did, p_0_2_b.ref, 'p_0_2_0_b', addHours(tenHoursAgo, 6)) // 2 likes
  const p_0_2_1_a = await reply(users.alice.did, p_0_2_b.ref, 'p_0_2_1_a', addHours(tenHoursAgo, 7)) // 1 like
  const p_0_2_2_c = await reply(users.carol.did, p_0_2_b.ref, 'p_0_2_2_c', addHours(tenHoursAgo, 8)) // 0 likes

  // likes depth 1
  await sc.like(users.alice.did, p_0_2_b.ref)
  await sc.like(users.carol.did, p_0_2_b.ref)
  await sc.like(users.op.did, p_0_1_c.ref)  // op like, bumps hotness.
  await sc.like(users.bob.did, p_0_1_c.ref)
  await sc.like(users.carol.did, p_0_1_c.ref)

  // likes depth 2
  await sc.like(users.bob.did, p_0_0_1_a.ref)
  await sc.like(users.carol.did, p_0_0_1_a.ref)
  await sc.like(users.op.did, p_0_0_2_b.ref) // op like, bumps hotness.
  await sc.like(users.bob.did, p_0_1_1_c.ref)
  await sc.like(users.carol.did, p_0_1_1_c.ref)
  await sc.like(users.bob.did, p_0_1_0_b.ref)
  await sc.like(users.bob.did, p_0_2_0_b.ref)
  await sc.like(users.carol.did, p_0_2_0_b.ref)
  await sc.like(users.bob.did, p_0_2_1_a.ref)

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0_o,
      p_0_0_a,
      p_0_0_0_c,
      p_0_0_1_a,
      p_0_0_2_b,
      p_0_1_c,
      p_0_1_0_b,
      p_0_1_1_c,
      p_0_1_2_a,
      p_0_2_b,
      p_0_2_0_b,
      p_0_2_1_a,
      p_0_2_2_c,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function threadSortingSeedWithOpAndViewerReplies(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'sort2', [
    'op',
    'viewer',
    'alice',
    'bob',
    'carol',
  ] as const)

  const tenHoursAgo = subHours(new Date(), 10)
  // TODO: throw if date becomes in the future?
  const h = (h: number) => addHours(tenHoursAgo, h)
  const p_0_o = await sc.post(users.op.did, 'p_0_o', undefined, undefined, undefined, { createdAt: tenHoursAgo.toISOString()} )

  const reply = (user: string, parent: RecordRef, text: string, createdAt?: Date) => {
    return sc.reply(user, p_0_o.ref, parent, text, undefined, undefined, createdAt ? { createdAt: createdAt.toISOString()} : undefined)
  }

  const p_0_0_a = await reply(users.alice.did, p_0_o.ref, 'p_0_0_a', h(0)) // 1 like
  const p_0_0_0_c = await reply(users.carol.did, p_0_0_a.ref, 'p_0_0_0_c', h(1)) // 0 likes
  const p_0_0_1_a = await reply(users.alice.did, p_0_0_a.ref, 'p_0_0_1_a', h(2)) // 2 likes
  const p_0_0_2_b = await reply(users.bob.did, p_0_0_a.ref, 'p_0_0_2_b', h(3)) // 1 like
  const p_0_0_3_v = await reply(users.viewer.did, p_0_0_a.ref, 'p_0_0_3_v', h(4)) // 0 likes
  const p_0_0_4_o = await reply(users.op.did, p_0_0_a.ref, 'p_0_0_4_o', h(5)) // 0 likes

  const p_0_1_c = await reply(users.carol.did, p_0_o.ref, 'p_0_1_c', h(1)) // 3 likes
  const p_0_1_0_b = await reply(users.bob.did, p_0_1_c.ref, 'p_0_1_0_b', h(2)) // 1 like
  const p_0_1_1_c = await reply(users.carol.did, p_0_1_c.ref, 'p_0_1_1_c', h(3)) // 2 likes
  const p_0_1_2_o = await reply(users.op.did, p_0_1_c.ref, 'p_0_1_2_o', h(4)) // 0 likes
  const p_0_1_3_v = await reply(users.viewer.did, p_0_1_c.ref, 'p_0_1_3_v', h(5)) // 1 like
  const p_0_1_4_a = await reply(users.alice.did, p_0_1_c.ref, 'p_0_1_4_a', h(6)) // 0 likes

  const p_0_2_b = await reply(users.bob.did, p_0_o.ref, 'p_0_2_b', h(2)) // 2 likes
  const p_0_2_0_v = await reply(users.viewer.did, p_0_2_b.ref, 'p_0_2_0_v', h(3)) // 0 likes
  const p_0_2_1_b = await reply(users.bob.did, p_0_2_b.ref, 'p_0_2_1_b', h(4)) // 4 likes
  const p_0_2_2_o = await reply(users.op.did, p_0_2_b.ref, 'p_0_2_2_o', h(5)) // 0 likes
  const p_0_2_3_a = await reply(users.alice.did, p_0_2_b.ref, 'p_0_2_3_a', h(6)) // 1 like
  const p_0_2_4_c = await reply(users.carol.did, p_0_2_b.ref, 'p_0_2_4_c', h(7)) // 1 like

  const p_0_3_o = await reply(users.op.did, p_0_o.ref, 'p_0_3_o', h(3)) // 0 likes
  const p_0_3_0_v = await reply(users.viewer.did, p_0_3_o.ref, 'p_0_3_0_v', h(4)) // 0 likes
  const p_0_3_1_b = await reply(users.bob.did, p_0_3_o.ref, 'p_0_3_1_b', h(5)) // 0 likes
  const p_0_3_2_o = await reply(users.op.did, p_0_3_o.ref, 'p_0_3_2_o', h(6)) // 0 likes
  const p_0_3_3_a = await reply(users.alice.did, p_0_3_o.ref, 'p_0_3_3_a', h(7)) // 0 likes
  const p_0_3_4_c = await reply(users.carol.did, p_0_3_o.ref, 'p_0_3_4_c', h(8)) // 0 likes

  const p_0_4_v = await reply(users.viewer.did, p_0_o.ref, 'p_0_4_v', h(4)) // 0 likes
  const p_0_4_0_b = await reply(users.bob.did, p_0_4_v.ref, 'p_0_4_0_b', h(5)) // 1 like
  const p_0_4_1_c = await reply(users.carol.did, p_0_4_v.ref, 'p_0_4_1_c', h(6)) // 1 like
  const p_0_4_2_o = await reply(users.op.did, p_0_4_v.ref, 'p_0_4_2_o', h(7)) // 0 likes
  const p_0_4_3_v = await reply(users.viewer.did, p_0_4_v.ref, 'p_0_4_3_v', h(8)) // 0 likes
  const p_0_4_4_a = await reply(users.alice.did, p_0_4_v.ref, 'p_0_4_4_a', h(9)) // 0 likes

  // likes depth 1
  await sc.like(users.alice.did, p_0_2_b.ref)
  await sc.like(users.carol.did, p_0_2_b.ref)
  await sc.like(users.viewer.did, p_0_0_a.ref)
  await sc.like(users.op.did, p_0_1_c.ref)  // op like, bumps hotness.
  await sc.like(users.bob.did, p_0_1_c.ref)
  await sc.like(users.carol.did, p_0_1_c.ref)

  // likes depth 2
  await sc.like(users.bob.did, p_0_0_1_a.ref)
  await sc.like(users.carol.did, p_0_0_1_a.ref)
  await sc.like(users.op.did, p_0_0_2_b.ref) // op like, bumps hotness.
  await sc.like(users.bob.did, p_0_1_1_c.ref)
  await sc.like(users.carol.did, p_0_1_1_c.ref)
  await sc.like(users.bob.did, p_0_1_0_b.ref)
  await sc.like(users.alice.did, p_0_2_1_b.ref)
  await sc.like(users.bob.did, p_0_2_1_b.ref)
  await sc.like(users.carol.did, p_0_2_1_b.ref)
  await sc.like(users.viewer.did, p_0_2_1_b.ref)
  await sc.like(users.bob.did, p_0_1_3_v.ref)
  await sc.like(users.bob.did, p_0_2_3_a.ref)
  await sc.like(users.viewer.did, p_0_2_4_c.ref)
  await sc.like(users.viewer.did, p_0_4_0_b.ref)
  await sc.like(users.alice.did, p_0_4_1_c.ref)

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0_o,
      p_0_0_a,
      p_0_0_0_c,
      p_0_0_1_a,
      p_0_0_2_b,
      p_0_0_3_v,
      p_0_0_4_o,
      p_0_1_c,
      p_0_1_0_b,
      p_0_1_1_c,
      p_0_1_2_o,
      p_0_1_3_v,
      p_0_1_4_a,
      p_0_2_b,
      p_0_2_0_v,
      p_0_2_1_b,
      p_0_2_2_o,
      p_0_2_3_a,
      p_0_2_4_c,
      p_0_3_o,
      p_0_3_0_v,
      p_0_3_1_b,
      p_0_3_2_o,
      p_0_3_3_a,
      p_0_3_4_c,
      p_0_4_v,
      p_0_4_0_b,
      p_0_4_1_c,
      p_0_4_2_o,
      p_0_4_3_v,
      p_0_4_4_a,
    },
  }
}

// ignored so it's easier to read the seeds
// prettier-ignore
export async function threadWithFollows(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'follow', [
    'op',
    'viewerF',
    'viewerNoF',
    'alice',
    'bob',
    'carol',
  ] as const)

  const tenHoursAgo = subHours(new Date(), 10)
  const h = (h: number) => addHours(tenHoursAgo, h)

  const p_0_o = await sc.post(users.op.did, 'p_0_o', undefined, undefined, undefined, { createdAt: tenHoursAgo.toISOString()} )

  const r = (user: string, parent: RecordRef, text: string, createdAt?: Date) => {
    return sc.reply(user, p_0_o.ref, parent, text, undefined, undefined, createdAt ? { createdAt: createdAt.toISOString()} : undefined)
  }

  const p_0_0_a = await r(users.alice.did, p_0_o.ref, 'p_0_0_a', h(0))
  const p_0_1_b = await r(users.bob.did, p_0_o.ref, 'p_0_1_b', h(1))
  const p_0_2_c = await r(users.carol.did, p_0_o.ref, 'p_0_2_c', h(2))
  const p_0_3_o = await r(users.op.did, p_0_o.ref, 'p_0_3_o', h(3))
  const p_0_4_f = await r(users.viewerF.did, p_0_o.ref, 'p_0_4_f', h(4))
  const p_0_5_n = await r(users.viewerNoF.did, p_0_o.ref, 'p_0_5_n', h(5))

  await sc.follow(users.viewerF.did, users.alice.did)
  await sc.follow(users.viewerF.did, users.bob.did)
  // Does not follow carol.

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      p_0_o,
      p_0_0_a,
      p_0_1_b,
      p_0_2_c,
      p_0_3_o,
      p_0_4_f,
      p_0_5_n,
    },
  }
}

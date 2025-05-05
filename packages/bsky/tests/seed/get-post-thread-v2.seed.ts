import { SeedClient, TestNetwork, TestNetworkNoAppView } from '@atproto/dev-env'
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

  await sc.follow(users.dan.did, users.alice.did)
  await sc.follow(users.dan.did, users.bob.did)

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
export async function sortingSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'fl', [
    'op',
    'alice',
    'bob',
  ] as const)

  const root = await sc.post(users.op.did, 'root')

  const root_op1 = await sc.reply(users.op.did, root.ref, root.ref, 'root_op1') // thread
  const root_op1_op1 = await sc.reply(users.op.did, root.ref, root_op1.ref, 'root_op1_op1') // thread
  const root_op1_op1_op1 = await sc.reply(users.op.did, root.ref, root_op1_op1.ref, 'root_op1_op1_op1') // thread
  const root_a1 = await sc.reply(users.alice.did, root.ref, root.ref, 'root_a1')
  const root_a1_a2 = await sc.reply(users.alice.did, root.ref, root_a1.ref, 'root_a1_a2')
  const root_op2 = await sc.reply(users.op.did, root.ref, root.ref, 'root_op2') // thread
  const root_op2_b1 = await sc.reply(users.bob.did, root.ref, root_op2.ref, 'root_op2_b1')
  const root_op2_b1_op1 = await sc.reply(users.op.did, root.ref, root.ref, 'root_op2_b1_op1') // not thread

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      root,
      root_op1,
      root_op1_op1,
      root_op1_op1_op1,
      root_a1,
      root_a1_a2,
      root_op2,
      root_op2_b1,
      root_op2_b1_op1,
    },
  }
}

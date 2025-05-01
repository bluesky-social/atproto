import { SeedClient, TestNetwork, TestNetworkNoAppView } from '@atproto/dev-env'

import { createUsers } from './util'

// ignored so it's easier to read the seeds
// prettier-ignore
export async function baseSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = await createUsers(sc, 'base', [
    'op',
    'alice',
    'bob',
    'carla',
    'dan'
  ] as const)

  const root = await sc.post(users.op.did, 'root')

  const op1_0 = await sc.reply(users.op.did, root.ref, root.ref, '(op) 1_0')
  const op1_1 = await sc.reply(users.op.did, root.ref, op1_0.ref, '(op) 1_1')
  const op1_1_1 = await sc.reply(users.op.did, root.ref, op1_1.ref, '(op) 1_1_1')
  const op1_1_1_1 = await sc.reply(users.op.did, root.ref, op1_1_1.ref, '(op) 1_1_1_1')
  const op1_1_1_1_1 = await sc.reply(users.op.did, root.ref, op1_1_1_1.ref, '(op) 1_1_1_1_1')
  const op1_2 = await sc.reply(users.op.did, root.ref, op1_1.ref, '(op) 1_2')

  const a1_0 = await sc.reply(users.alice.did, root.ref, root.ref, '(alice) 1_0')
  const b1_0 = await sc.reply(users.bob.did, root.ref, root.ref, '(bob) 1_0')
  const c1_0 = await sc.reply(users.carla.did, root.ref, root.ref, '(carla) 1_0')

  const op2_0 = await sc.reply(users.op.did, root.ref, root.ref, '(op) 2_0')
  const op2_1 = await sc.reply(users.op.did, root.ref, op2_0.ref, '(op) 2_1')
  const a2_2 = await sc.reply(users.alice.did, root.ref, op2_1.ref, '(alice) 2_2')
  const op2_3 = await sc.reply(users.op.did, root.ref, a2_2.ref, '(op) 2_3')
  const op2_4 = await sc.reply(users.op.did, root.ref, op2_3.ref, '(op) 2_4')

  const a2_0 = await sc.reply(users.alice.did, root.ref, root.ref, '(alice) 2_0')
  const b2_0 = await sc.reply(users.bob.did, root.ref, root.ref, '(bob) 2_0')
  const c2_0 = await sc.reply(users.carla.did, root.ref, root.ref, '(carla) 2_0')

  await sc.like(users.op.did, a2_0.ref)
  await sc.like(users.bob.did, a2_0.ref)
  await sc.like(users.carla.did, a2_0.ref)
  await sc.like(users.dan.did, a2_0.ref)

  await sc.like(users.op.did, b2_0.ref)
  await sc.like(users.alice.did, b2_0.ref)
  await sc.like(users.carla.did, b2_0.ref)

  await sc.like(users.op.did, c2_0.ref)
  await sc.like(users.bob.did, c2_0.ref)

  await sc.follow(users.dan.did, users.alice.did)
  await sc.follow(users.dan.did, users.bob.did)

  await sc.network.processAll()

  return {
    seedClient: sc,
    users,
    posts: {
      root,

      op1_0,
      op1_1,
      op1_1_1,
      op1_1_1_1,
      op1_1_1_1_1,
      op1_2,

      op2_0,
      op2_1,
      a2_2,
      op2_3,
      op2_4,

      a1_0,
      b1_0,
      c1_0,
      a2_0,
      b2_0,
      c2_0,
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

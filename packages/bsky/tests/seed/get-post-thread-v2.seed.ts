import { SeedClient, TestNetwork, TestNetworkNoAppView } from '@atproto/dev-env'

import {createUserStub} from './util'

export type Users = typeof userStubs
export type Seed = Awaited<ReturnType<typeof seed>>

const userStubs = {
  opp: createUserStub('opp'),

  alice: createUserStub('alice'),
  bob: createUserStub('bob'),
  carla: createUserStub('carla'),
  dan: createUserStub('dan'),
}

export async function seed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = structuredClone(userStubs)

  await sc.createAccount('opp', users.opp)
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)
  await sc.createAccount('carla', users.carla)
  await sc.createAccount('dan', users.dan)

  Object.values(users).forEach((user) => {
    users[user.id].did = sc.dids[user.id]
  })

  const root = await sc.post(users.opp.did, 'root')

  const op1_0 = await sc.reply(users.opp.did, root.ref, root.ref, '(opp) 1_0')
  const op1_1 = await sc.reply(users.opp.did, root.ref, op1_0.ref, '(opp) 1_1')
  const op1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1.ref, '(opp) 1_1_1')
  const op1_1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1_1.ref, '(opp) 1_1_1_1')
  const op1_1_1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1_1_1.ref, '(opp) 1_1_1_1_1')
  const op1_2 = await sc.reply(users.opp.did, root.ref, op1_1.ref, '(opp) 1_2')

  const a1_0 = await sc.reply(users.alice.did, root.ref, root.ref, '(alice) 1_0')
  const b1_0 = await sc.reply(users.bob.did, root.ref, root.ref, '(bob) 1_0')
  const c1_0 = await sc.reply(users.carla.did, root.ref, root.ref, '(carla) 1_0')

  const op2_0 = await sc.reply(users.opp.did, root.ref, root.ref, '(opp) 2_0')
  const op2_1 = await sc.reply(users.opp.did, root.ref, op2_0.ref, '(opp) 2_1')
  const a2_2 = await sc.reply(users.alice.did, root.ref, op2_1.ref, '(alice) 2_2')
  const op2_3 = await sc.reply(users.opp.did, root.ref, a2_2.ref, '(opp) 2_3')
  const op2_4 = await sc.reply(users.opp.did, root.ref, op2_3.ref, '(opp) 2_4')

  const a2_0 = await sc.reply(users.alice.did, root.ref, root.ref, '(alice) 2_0')
  const b2_0 = await sc.reply(users.bob.did, root.ref, root.ref, '(bob) 2_0')
  const c2_0 = await sc.reply(users.carla.did, root.ref, root.ref, '(carla) 2_0')

  await sc.like(users.opp.did, a2_0.ref)
  await sc.like(users.bob.did, a2_0.ref)
  await sc.like(users.carla.did, a2_0.ref)
  await sc.like(users.dan.did, a2_0.ref)

  await sc.like(users.opp.did, b2_0.ref)
  await sc.like(users.alice.did, b2_0.ref)
  await sc.like(users.carla.did, b2_0.ref)

  await sc.like(users.opp.did, c2_0.ref)
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

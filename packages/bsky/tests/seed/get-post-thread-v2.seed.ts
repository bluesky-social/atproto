import { SeedClient, TestNetwork, TestNetworkNoAppView } from '@atproto/dev-env'

import {createUserStub} from './util'

export type Users = typeof userStubs
export type Seed = Awaited<ReturnType<typeof seed>>

const userStubs = {
  opp: createUserStub('opp'),

  alice: createUserStub('alice'),
  bob: createUserStub('bob'),
}

export async function seed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  const users = structuredClone(userStubs)

  await sc.createAccount('opp', users.opp)
  await sc.createAccount('alice', users.alice)
  await sc.createAccount('bob', users.bob)

  Object.values(users).forEach((user) => {
    users[user.id].did = sc.dids[user.id]
  })

  const root = await sc.post(users.opp.did, 'root')

  const op1_0 = await sc.reply(users.opp.did, root.ref, root.ref, '(opp) 1')
  const op1_1 = await sc.reply(users.opp.did, root.ref, op1_0.ref, '(opp) 1_1')
  const op1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1.ref, '(opp) 1_1_1')
  const op1_1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1_1.ref, '(opp) 1_1_1_1')
  const op1_1_1_1_1 = await sc.reply(users.opp.did, root.ref, op1_1_1_1.ref, '(opp) 1_1_1_1_1')
  const op1_2 = await sc.reply(users.opp.did, root.ref, op1_1.ref, '(opp) 1_2')

  const op2_0 = await sc.reply(users.opp.did, root.ref, root.ref, '(opp) 2')
  const op2_1 = await sc.reply(users.opp.did, root.ref, op2_0.ref, '(opp) 2_1')
  const a2_2 = await sc.reply(users.alice.did, root.ref, op2_1.ref, '(alice) 2_2')
  const op2_3 = await sc.reply(users.opp.did, root.ref, a2_2.ref, '(opp) 2_3')
  const op2_4 = await sc.reply(users.opp.did, root.ref, op2_3.ref, '(opp) 2_4')

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
    },
  }
}

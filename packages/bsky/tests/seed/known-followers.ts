import { TestNetwork, SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'

export type User = {
  email: string
  handle: string
  password: string
  displayName: string
  description: string
  selfLabels: undefined
}

function createUser(name: string): User {
  return {
    email: `${name}@test.com`,
    handle: `${name}.test`,
    password: `${name}-pass`,
    displayName: name,
    description: `hi im ${name} label_me`,
    selfLabels: undefined,
  }
}

const users = {
  /*
   * Base test. One known follower.
   */
  base_sub: createUser('base-sub'),
  base_res_1: createUser('base-res-1'),
  base_view: createUser('base-view'),

  /*
   * First-part block of a single known follower.
   */
  fp_block_sub: createUser('fp-block-sub'),
  fp_block_res_1: createUser('fp-block-res-1'),
  fp_block_view: createUser('fp-block-view'),

  /*
   * Second-party block of a single known follower.
   */
  sp_block_sub: createUser('sp-block-sub'),
  sp_block_res_1: createUser('sp-block-res-1'),
  sp_block_view: createUser('sp-block-view'),
}

export async function knownFollowersSeed(
  sc: SeedClient<TestNetwork | TestNetworkNoAppView>,
) {
  await sc.createAccount('base_sub', users.base_sub)
  await sc.createAccount('base_res_1', users.base_res_1)
  await sc.createAccount('base_view', users.base_view)

  await sc.createAccount('fp_block_sub', users.fp_block_sub)
  await sc.createAccount('fp_block_res_1', users.fp_block_res_1)
  await sc.createAccount('fp_block_view', users.fp_block_view)

  await sc.createAccount('sp_block_sub', users.sp_block_sub)
  await sc.createAccount('sp_block_res_1', users.sp_block_res_1)
  await sc.createAccount('sp_block_view', users.sp_block_view)

  const dids = sc.dids

  await sc.follow(dids.base_res_1, dids.base_sub)
  await sc.follow(dids.base_view, dids.base_res_1)

  await sc.follow(dids.fp_block_res_1, dids.fp_block_sub)
  await sc.follow(dids.fp_block_view, dids.fp_block_res_1)

  await sc.follow(dids.sp_block_res_1, dids.sp_block_sub)
  await sc.follow(dids.sp_block_view, dids.sp_block_res_1)

  await sc.network.processAll()

  return {
    users,
    seedClient: sc,
  }
}

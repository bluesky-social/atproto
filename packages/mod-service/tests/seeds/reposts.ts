import { SeedClient } from '@atproto/dev-env'
import basicSeed from './basic'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  })
  await sc.repost(sc.dids.bob, sc.posts[sc.dids.alice][2].ref)
  await sc.repost(sc.dids.carol, sc.posts[sc.dids.alice][2].ref)
  await sc.repost(sc.dids.dan, sc.posts[sc.dids.alice][2].ref)
  await sc.repost(sc.dids.eve, sc.posts[sc.dids.alice][2].ref)
  await sc.repost(sc.dids.dan, sc.replies[sc.dids.bob][0].ref)
  await sc.repost(sc.dids.eve, sc.replies[sc.dids.bob][0].ref)
  return sc
}

import { SeedClient } from '@atproto/dev-env'
import basicSeed from './basic'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  })
  await sc.like(sc.dids.eve, sc.posts[sc.dids.alice][1].ref)
  await sc.like(sc.dids.carol, sc.replies[sc.dids.bob][0].ref)
  return sc
}

import basicSeed from './basic'
import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    username: 'eve.test',
    password: 'eve-pass',
  })
  await sc.like(sc.dids.eve, sc.posts[sc.dids.alice][1].uriRaw)
  await sc.like(sc.dids.carol, sc.replies[sc.dids.bob][0].uriRaw)
  await sc.like(sc.dids.eve, sc.reposts[sc.dids.dan][0].toString())
  return sc
}

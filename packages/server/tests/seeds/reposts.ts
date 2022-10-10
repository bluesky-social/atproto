import basicSeed from './basic'
import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    username: 'eve.test',
    password: 'eve-pass',
  })
  await sc.repost(sc.dids.bob, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.repost(sc.dids.carol, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.repost(sc.dids.dan, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.repost(sc.dids.eve, sc.posts[sc.dids.alice][2].uriRaw)
  await sc.repost(sc.dids.dan, sc.replies[sc.dids.bob][0].uriRaw)
  await sc.repost(sc.dids.eve, sc.replies[sc.dids.bob][0].uriRaw)
  return sc
}

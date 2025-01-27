import basicSeed from './basic'
import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  })
  await sc.like(sc.dids.eve, sc.posts[sc.dids.alice][1].ref)
  await sc.like(sc.dids.carol, sc.replies[sc.dids.bob][0].ref)

  // give alice > 100 likes
  for (let i = 0; i < 50; i++) {
    const [b, c, d] = await Promise.all([
      sc.post(sc.dids.bob, `bob post ${i}`),
      sc.post(sc.dids.carol, `carol post ${i}`),
      sc.post(sc.dids.dan, `dan post ${i}`),
    ])
    await Promise.all(
      [
        sc.like(sc.dids.alice, b.ref), // likes 50 of bobs posts
        i < 45 && sc.like(sc.dids.alice, c.ref), // likes 45 of carols posts
        i < 40 && sc.like(sc.dids.alice, d.ref), // likes 40 of dans posts
      ].filter(Boolean),
    )
  }

  // couple more NPCs for suggested follows
  await sc.createAccount('fred', {
    email: 'fred@test.com',
    handle: 'fred.test',
    password: 'fred-pass',
  })
  await sc.createAccount('gina', {
    email: 'gina@test.com',
    handle: 'gina.test',
    password: 'gina-pass',
  })

  return sc
}

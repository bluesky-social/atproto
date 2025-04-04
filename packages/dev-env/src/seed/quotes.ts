import { default as basicSeed } from './basic'
import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  })

  await sc.post(
    sc.dids.eve,
    'qUoTe 1',
    undefined,
    undefined,
    sc.posts[sc.dids.alice][0].ref,
  )
  await sc.post(
    sc.dids.eve,
    'qUoTe 2',
    undefined,
    undefined,
    sc.posts[sc.dids.alice][0].ref,
  )

  await sc.post(
    sc.dids.eve,
    'qUoTe 3',
    undefined,
    undefined,
    sc.replies[sc.dids.bob][0].ref,
  )

  const carolPost = await sc.post(sc.dids.carol, 'post')
  await sc.post(sc.dids.eve, 'qUoTe 4', undefined, undefined, carolPost.ref)

  const spamPosts: Promise<any>[] = []
  for (let i = 0; i < 5; i++) {
    spamPosts.push(
      sc.post(
        sc.dids.eve,
        `MASSIVE QUOTE SPAM ${i + 1}`,
        undefined,
        undefined,
        sc.posts[sc.dids.alice][1].ref,
      ),
    )
  }
  await Promise.all(spamPosts)

  return sc
}

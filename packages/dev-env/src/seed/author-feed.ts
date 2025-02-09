import basicSeed from './basic'
import { SeedClient } from './client'

export default async (sc: SeedClient) => {
  await basicSeed(sc)
  await sc.createAccount('eve', {
    email: 'eve@test.com',
    handle: 'eve.test',
    password: 'eve-pass',
  })
  await sc.createAccount('fred', {
    email: 'fred@test.com',
    handle: 'fred.test',
    password: 'fred-pass',
  })

  const alice = sc.dids.alice
  const eve = sc.dids.eve
  const fred = sc.dids.fred

  /*
   * Self thread
   */
  await sc.post(eve, evePosts[0])
  await sc.reply(
    eve,
    sc.posts[eve][0].ref,
    sc.posts[eve][0].ref,
    eveOwnThreadReplies[0],
  )
  await sc.reply(
    eve,
    sc.posts[eve][0].ref,
    sc.replies[eve][0].ref,
    eveOwnThreadReplies[1],
  )
  await sc.reply(
    eve,
    sc.posts[eve][0].ref,
    sc.replies[eve][1].ref,
    eveOwnThreadReplies[2],
  )

  /**
   * Two replies to Alice
   */
  await sc.reply(
    eve,
    sc.posts[alice][1].ref,
    sc.posts[alice][1].ref,
    eveAliceReplies[0],
  )
  await sc.reply(
    eve,
    sc.posts[alice][1].ref,
    sc.replies[eve][3].ref,
    eveAliceReplies[1],
  )

  /**
   * Two replies to Fred, who replied to Eve's root post. This creates a
   * "detached" thread, where one Fred post breaks the continuity.
   */
  await sc.post(eve, evePosts[1])
  const fredReply = await sc.reply(
    fred,
    sc.posts[eve][1].ref,
    sc.posts[eve][1].ref,
    fredReplies[0],
  )
  await sc.reply(
    eve,
    sc.posts[eve][1].ref,
    sc.replies[fred][0].ref,
    eveFredReplies[0],
  )
  await sc.reply(
    eve,
    sc.posts[eve][1].ref,
    sc.replies[eve][4].ref,
    eveFredReplies[1],
  )

  // a repost for eve's feed
  await sc.repost(eve, fredReply.ref)

  return sc
}

const evePosts = ['eve own thread', 'eve detached thread']
const eveOwnThreadReplies = [
  'eve own reply 1',
  'eve own reply 2',
  'eve own reply 3',
]
const eveAliceReplies = ['eve reply to alice 1', 'eve reply to alice 2']
const eveFredReplies = ['eve reply to fred 1', 'eve reply to fred 2']
const fredReplies = ['fred reply to eve 1']

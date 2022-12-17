import { AtUri } from '@atproto/uri'
import AtpApi, { ServiceClient as AtpServiceClient } from '@atproto/api'
import { Database } from '../../src'
import { runTestServer, CloseFn } from '../_util'
import { SeedClient } from '../seeds/client'
import usersSeed from '../seeds/users'
import scenesSeed from '../seeds/scenes'
import { MessageQueue } from '../../src/event-stream/types'

describe('message queue', () => {
  let close: CloseFn
  let client: AtpServiceClient
  let sc: SeedClient
  let db: Database
  let messageQueue: MessageQueue

  let uri1: AtUri, uri2: AtUri

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'event_stream_message_queue',
    })
    close = server.close
    db = server.ctx.db
    messageQueue = server.ctx.messageQueue
    client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await usersSeed(sc)
    await scenesSeed(sc)
    await messageQueue.processAll()

    const post1 = await sc.post(sc.dids.alice, 'test1')
    const post2 = await sc.post(sc.dids.bob, 'test2')
    uri1 = post1.ref.uri
    uri2 = post2.ref.uri
  })

  afterAll(async () => {
    if (close) {
      await close()
    }
  })

  it('processes memberCounts', async () => {
    const res = await db.db
      .selectFrom('scene_member_count')
      .selectAll()
      .execute()
    const checkCount = (scene: string, members: number) => {
      const found = res.find((row) => row.did === sc.scenes[scene].did)
      expect(found?.count).toBe(members)
    }
    checkCount('scene.test', 4)
    checkCount('alice-scene.test', 1)
    checkCount('other-scene.test', 1)
    checkCount('carol-scene.test', 3)
  })

  it('handles vote increments', async () => {
    await messageQueue.send(db, {
      type: 'add_upvote',
      user: sc.dids.alice,
      subject: uri1.toString(),
    })
    await messageQueue.send(db, {
      type: 'add_upvote',
      user: sc.dids.bob,
      subject: uri1.toString(),
    })
    await messageQueue.send(db, {
      type: 'add_upvote',
      user: sc.dids.carol,
      subject: uri1.toString(),
    })
    await messageQueue.send(db, {
      type: 'add_upvote',
      user: sc.dids.alice,
      subject: uri2.toString(),
    })

    await messageQueue.processAll()

    const res = await db.db
      .selectFrom('scene_votes_on_post')
      .selectAll()
      .execute()

    const checkCount = (
      scene: string,
      subject: AtUri,
      votes: number,
      posted: boolean,
    ) => {
      const found = res.find(
        (row) =>
          row.did === sc.scenes[scene].did &&
          row.subject === subject.toString(),
      )
      expect(found?.count || 0).toBe(votes)
      const didPost = found?.postedTrending === 1
      expect(didPost).toBe(posted)
    }
    checkCount('scene.test', uri1, 3, true)
    checkCount('scene.test', uri2, 1, false)
    checkCount('other-scene.test', uri1, 1, false)
    checkCount('other-scene.test', uri2, 0, false)
    checkCount('alice-scene.test', uri1, 1, false)
    checkCount('alice-scene.test', uri2, 1, false)
    checkCount('carol-scene.test', uri1, 2, true)
    checkCount('carol-scene.test', uri2, 1, false)
  })
})

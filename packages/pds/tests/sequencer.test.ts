import AtpApi from '@atproto/api'
import { Database } from '../src'
import Sequencer, { RepoEvent } from '../src/sequencer'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { CloseFn, runTestServer } from './_util'
import Outbox from '../src/sequencer/outbox'
import { randomStr } from '@atproto/crypto'

describe('sequencer', () => {
  let db: Database
  let sequencer: Sequencer
  let close: CloseFn
  let sc: SeedClient
  let alice: string
  let bob: string

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'db',
    })
    close = server.close
    db = server.ctx.db
    sequencer = server.ctx.sequencer
    const client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    alice = sc.dids.alice
    bob = sc.dids.bob
    await userSeed(sc)
  })

  afterAll(async () => {
    await close()
  })

  const createPosts = async (count: number): Promise<void> => {
    const randomPost = (by: string) => sc.post(by, randomStr(8, 'base32'))
    for (let i = 0; i < count; i++) {
      await Promise.all([randomPost(alice), randomPost(bob)])
    }
  }

  it('sends to outbox', async () => {
    const count = 100
    // await createPosts(count)
    const outbox = new Outbox(sequencer)
    const evts: RepoEvent[] = []
    for await (const evt of outbox.events()) {
      evts.push(evt)
      console.log(evts.length)
      if (evts.length >= count) break
    }
    expect(evts.length).toBe(count)
  })
})

import AtpApi from '@atproto/api'
import Sequencer, { RepoEvent } from '../src/sequencer'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { CloseFn, runTestServer } from './_util'
import Outbox from '../src/sequencer/outbox'
import { randomStr } from '@atproto/crypto'

describe('sequencer', () => {
  let sequencer: Sequencer
  let close: CloseFn
  let sc: SeedClient
  let alice: string
  let bob: string

  let totalEvts

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'db',
    })
    close = server.close
    sequencer = server.ctx.sequencer
    const client = AtpApi.service(server.url)
    sc = new SeedClient(client)
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    // 6 events in userSeed
    totalEvts = 6
  })

  afterAll(async () => {
    await close()
  })

  const randomPost = async (by: string) => sc.post(by, randomStr(8, 'base32'))
  const createPosts = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) {
      await Promise.all([randomPost(alice), randomPost(bob)])
    }
  }

  const getAllEvents = async (ob: Outbox, expected: number) => {
    const evts: RepoEvent[] = []
    for await (const evt of ob.events()) {
      evts.push(evt)
      if (evts.length >= expected) break
    }
    return evts
  }

  it('sends to outbox', async () => {
    const count = 20
    totalEvts += count * 2
    await createPosts(count)
    const outbox = new Outbox(sequencer)
    const evts = await getAllEvents(outbox, totalEvts)
    expect(evts.length).toBe(totalEvts)
  })

  it('handles cut over', async () => {
    const count = 20
    totalEvts += count * 2
    const outbox = new Outbox(sequencer)
    const [evts] = await Promise.all([
      getAllEvents(outbox, totalEvts),
      createPosts(count),
    ])
    expect(evts.length).toBe(totalEvts)
  })
})

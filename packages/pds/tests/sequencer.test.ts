import AtpApi from '@atproto/api'
import Sequencer, { RepoEvent } from '../src/sequencer'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { CloseFn, runTestServer } from './_util'
import Outbox, { StreamConsumerTooSlowError } from '../src/sequencer/outbox'
import { randomStr } from '@atproto/crypto'
import { wait } from '@atproto/common'

describe('sequencer', () => {
  let sequencer: Sequencer
  let close: CloseFn
  let sc: SeedClient
  let alice: string
  let bob: string

  let totalEvts
  const timeBeforeWrites = new Date().toISOString()
  let lastSeen: string

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
    const promises: Promise<unknown>[] = []
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        promises.push(randomPost(alice))
      } else {
        promises.push(randomPost(bob))
      }
      await Promise.all(promises)
    }
  }

  const readEvents = async (
    gen: AsyncGenerator<RepoEvent>,
    expected: number,
  ) => {
    const evts: RepoEvent[] = []
    while (evts.length < expected) {
      const evt = await gen.next()
      if (evt.done) break
      evts.push(evt.value)
    }
    return evts
  }

  it('sends to outbox', async () => {
    const count = 20
    totalEvts += count
    await createPosts(count)
    const outbox = new Outbox(sequencer)
    const evts = await readEvents(outbox.events(timeBeforeWrites), totalEvts)
    expect(evts.length).toBe(totalEvts)
    lastSeen = evts[evts.length - 1].time
  })

  it('handles cut over', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const [evts] = await Promise.all([
      readEvents(outbox.events(timeBeforeWrites), totalEvts),
      createPosts(count),
    ])
    expect(evts.length).toBe(totalEvts)
    lastSeen = evts[evts.length - 1].time
  })

  it('only gets events after lastSeen', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const gen = outbox.events(lastSeen)
    const [evts] = await Promise.all([
      readEvents(gen, count),
      createPosts(count),
    ])
    expect(evts.length).toBe(count)
    lastSeen = evts[evts.length - 1].time
  })

  it('buffers events that are not being read', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const evtGenerator = outbox.events(lastSeen)
    // read enough to start streaming then wait so that the rest go into the buffer,
    // then stream out from buffer
    const [firstPart] = await Promise.all([
      readEvents(evtGenerator, 5),
      createPosts(count),
    ])
    const secondPart = await readEvents(evtGenerator, 15)
    const evts = [...firstPart, ...secondPart]
    expect(evts.length).toBe(count)
    lastSeen = evts[evts.length - 1].time
  })

  it('errors when buffer is overloaded', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer, { maxBufferSize: 5 })
    const evtGenerator = outbox.events(lastSeen)
    // read enough to start streaming then wait to stream rest until buffer is overloaded
    const overloadBuffer = async () => {
      await Promise.all([readEvents(evtGenerator, 5), createPosts(count)])
      await wait(200)
      await readEvents(evtGenerator, 15)
    }
    await expect(overloadBuffer).rejects.toThrow(StreamConsumerTooSlowError)
  })
})

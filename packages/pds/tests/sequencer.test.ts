import AtpAgent from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { cborEncode, readFromGenerator, wait } from '@atproto/common'
import { Sequencer, SeqEvt } from '../src/sequencer'
import Outbox from '../src/sequencer/outbox'
import { Database } from '../src'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { TestServerInfo, runTestServer } from './_util'

describe('sequencer', () => {
  let server: TestServerInfo
  let db: Database
  let sequencer: Sequencer
  let sc: SeedClient
  let alice: string
  let bob: string

  let totalEvts
  let lastSeen: number

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'sequencer',
    })
    db = server.ctx.db
    sequencer = server.ctx.sequencer
    const agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    // 6 events in userSeed
    totalEvts = 6
  })

  afterAll(async () => {
    await server.close()
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

  const loadFromDb = (lastSeen: number) => {
    return db.db
      .selectFrom('repo_seq')
      .select([
        'seq',
        'did',
        'eventType',
        'event',
        'invalidated',
        'sequencedAt',
      ])
      .where('seq', '>', lastSeen)
      .orderBy('seq', 'asc')
      .execute()
  }

  const evtToDbRow = (e: SeqEvt) => {
    const did = e.type === 'commit' ? e.evt.repo : e.evt.did
    return {
      seq: e.seq,
      did,
      eventType: 'append',
      event: Buffer.from(cborEncode(e.evt)),
      invalidated: 0,
      sequencedAt: e.time,
    }
  }

  const caughtUp = (outbox: Outbox): (() => Promise<boolean>) => {
    return async () => {
      const leaderCaughtUp = await server.ctx.sequencerLeader?.isCaughtUp()
      if (!leaderCaughtUp) return false
      const lastEvt = await outbox.sequencer.curr()
      if (!lastEvt) return true
      return outbox.lastSeen >= (lastEvt.seq ?? 0)
    }
  }

  it('sends to outbox', async () => {
    const count = 20
    totalEvts += count
    await createPosts(count)
    const outbox = new Outbox(sequencer)
    const evts = await readFromGenerator(outbox.events(-1), caughtUp(outbox))
    expect(evts.length).toBe(totalEvts)

    const fromDb = await loadFromDb(-1)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('handles cut over', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const createPromise = createPosts(count)
    const [evts] = await Promise.all([
      readFromGenerator(outbox.events(-1), caughtUp(outbox), createPromise),
      createPromise,
    ])
    expect(evts.length).toBe(totalEvts)

    const fromDb = await loadFromDb(-1)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('only gets events after cursor', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const createPromise = createPosts(count)
    const [evts] = await Promise.all([
      readFromGenerator(
        outbox.events(lastSeen),
        caughtUp(outbox),
        createPromise,
      ),
      createPromise,
    ])

    // +1 because we send the lastSeen date as well
    expect(evts.length).toBe(count)

    const fromDb = await loadFromDb(lastSeen)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('buffers events that are not being read', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const createPromise = createPosts(count)
    const gen = outbox.events(lastSeen)
    // read enough to start streaming then wait so that the rest go into the buffer,
    // then stream out from buffer
    const [firstPart] = await Promise.all([
      readFromGenerator(gen, caughtUp(outbox), createPromise, 5),
      createPromise,
    ])
    const secondPart = await readFromGenerator(
      gen,
      caughtUp(outbox),
      createPromise,
    )
    const evts = [...firstPart, ...secondPart]
    expect(evts.length).toBe(count)

    const fromDb = await loadFromDb(lastSeen)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('errors when buffer is overloaded', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer, { maxBufferSize: 5 })
    const gen = outbox.events(lastSeen)
    const createPromise = createPosts(count)
    // read enough to start streaming then wait to stream rest until buffer is overloaded
    const overloadBuffer = async () => {
      await Promise.all([
        readFromGenerator(gen, caughtUp(outbox), createPromise, 5),
        createPromise,
      ])
      await wait(500)
      await readFromGenerator(gen, caughtUp(outbox), createPromise)
    }
    await expect(overloadBuffer).rejects.toThrow('Stream consumer too slow')

    const fromDb = await loadFromDb(lastSeen)
    lastSeen = fromDb.at(-1)?.seq ?? lastSeen
  })

  it('handles many open connections', async () => {
    const count = 20
    const outboxes: Outbox[] = []
    for (let i = 0; i < 50; i++) {
      outboxes.push(new Outbox(sequencer))
    }
    const createPromise = createPosts(count)
    const readOutboxes = Promise.all(
      outboxes.map((o) =>
        readFromGenerator(o.events(lastSeen), caughtUp(o), createPromise),
      ),
    )
    const [results] = await Promise.all([readOutboxes, createPromise])
    const fromDb = await loadFromDb(lastSeen)
    for (let i = 0; i < 50; i++) {
      const evts = results[i]
      expect(evts.length).toBe(count)
      expect(evts.map(evtToDbRow)).toEqual(fromDb)
    }
    lastSeen = results[0].at(-1)?.seq ?? lastSeen
  })
})

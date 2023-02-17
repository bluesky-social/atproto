import AtpAgent from '@atproto/api'
import { randomStr } from '@atproto/crypto'
import { readFromGenerator, wait } from '@atproto/common'
import Sequencer, { RepoAppendEvent } from '../src/sequencer'
import Outbox, { StreamConsumerTooSlowError } from '../src/sequencer/outbox'
import { Database } from '../src'
import { SeedClient } from './seeds/client'
import userSeed from './seeds/users'
import { CloseFn, runTestServer } from './_util'

describe('sequencer', () => {
  let db: Database
  let sequencer: Sequencer
  let close: CloseFn
  let sc: SeedClient
  let alice: string
  let bob: string

  let totalEvts
  let lastSeen: number

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'sequencer',
    })
    close = server.close
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

  const loadFromDb = (lastSeen: number) => {
    return db.db
      .selectFrom('repo_seq')
      .selectAll()
      .where('repo_seq.seq', '>', lastSeen)
      .orderBy('repo_seq.seq', 'asc')
      .execute()
  }

  const evtToDbRow = (e: RepoAppendEvent) => ({
    seq: e.seq,
    did: e.repo,
    commit: e.commit,
    eventType: 'repo_append',
    sequencedAt: e.time,
  })

  it('sends to outbox', async () => {
    const count = 20
    totalEvts += count
    await createPosts(count)
    const outbox = new Outbox(sequencer)
    const evts = await readFromGenerator(outbox.events(-1))
    expect(evts.length).toBe(totalEvts)

    const fromDb = await loadFromDb(-1)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('handles cut over', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const [evts] = await Promise.all([
      readFromGenerator(outbox.events(-1)),
      createPosts(count),
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
    const gen = outbox.events(lastSeen)
    const [evts] = await Promise.all([
      readFromGenerator(gen),
      createPosts(count),
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
    const evtGenerator = outbox.events(lastSeen)
    // read enough to start streaming then wait so that the rest go into the buffer,
    // then stream out from buffer
    const [firstPart] = await Promise.all([
      readFromGenerator(evtGenerator, 5),
      createPosts(count),
    ])
    const secondPart = await readFromGenerator(evtGenerator)
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
    const evtGenerator = outbox.events(lastSeen)
    // read enough to start streaming then wait to stream rest until buffer is overloaded
    const overloadBuffer = async () => {
      await Promise.all([
        readFromGenerator(evtGenerator, 5),
        createPosts(count),
      ])
      await wait(500)
      await readFromGenerator(evtGenerator)
    }
    await expect(overloadBuffer).rejects.toThrow(StreamConsumerTooSlowError)

    const fromDb = await loadFromDb(lastSeen)
    lastSeen = fromDb.at(-1)?.seq ?? lastSeen
  })

  it('handles many open connections', async () => {
    const count = 20
    const outboxes: Outbox[] = []
    for (let i = 0; i < 50; i++) {
      outboxes.push(new Outbox(sequencer))
    }
    const readOutboxes = Promise.all(
      outboxes.map((o) => readFromGenerator(o.events(lastSeen))),
    )
    const [results] = await Promise.all([readOutboxes, createPosts(count)])
    const fromDb = await loadFromDb(lastSeen)
    for (let i = 0; i < 50; i++) {
      const evts = results[i]
      expect(evts.length).toBe(count)
      expect(evts.map(evtToDbRow)).toEqual(fromDb)
    }
    lastSeen = results[0].at(-1)?.seq ?? lastSeen
  })
})

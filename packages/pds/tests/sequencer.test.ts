import {
  cborDecode,
  cborEncode,
  readFromGenerator,
  wait,
} from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import { readCarWithRoot } from '@atproto/repo'
import { sequencer } from '../../pds'
import { SeqEvt, Sequencer, formatSeqSyncEvt } from '../src/sequencer'
import { Outbox } from '../src/sequencer/outbox'
import userSeed from './seeds/users'

describe('sequencer', () => {
  let network: TestNetworkNoAppView
  let sequencer: Sequencer
  let sc: SeedClient
  let alice: string
  let bob: string

  let totalEvts
  let lastSeen: number

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sequencer',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    sequencer = network.pds.ctx.sequencer
    sc = network.getSeedClient()
    await userSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    // 18 events in userSeed
    totalEvts = 18
  })

  beforeEach(async () => {
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
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
    return sequencer.db.db
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
    const eventType = e.type === 'commit' ? 'append' : e.type
    return {
      seq: e.seq,
      did,
      eventType,
      event: Buffer.from(cborEncode(e.evt)),
      invalidated: 0,
      sequencedAt: e.time,
    }
  }

  const caughtUp = (outbox: Outbox): (() => Promise<boolean>) => {
    return async () => {
      const lastEvt = await outbox.sequencer.curr()
      if (lastEvt === null) return true
      return outbox.lastSeen >= (lastEvt ?? 0)
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

    await createPromise

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

  it('root block must be returned in sync event', async () => {
    const syncData = await network.pds.ctx.actorStore.read(
      sc.dids.alice,
      async (store) => {
        const root = await store.repo.storage.getRootDetailed()
        const { blocks } = await store.repo.storage.getBlocks([root.cid])
        return {
          cid: root.cid,
          rev: root.rev,
          blocks,
        }
      },
    )

    const dbEvt = await formatSeqSyncEvt(sc.dids.alice, syncData)
    const evt = cborDecode<sequencer.SyncEvt>(dbEvt.event)
    expect(evt.did).toBe(sc.dids.alice)
    const car = await readCarWithRoot(evt.blocks)
    expect(car.root.toString()).toBe(syncData.cid.toString())
    // in the case of tooBig, the blocks must contain the root block only
    expect(car.blocks.size).toBe(1)
    expect(car.blocks.has(syncData.cid)).toBeTruthy()
  })
})

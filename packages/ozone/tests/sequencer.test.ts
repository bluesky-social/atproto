import { readFromGenerator, wait } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { EXAMPLE_LABELER, TestNetwork } from '@atproto/dev-env'
import { Label } from '../src/lexicon/types/com/atproto/label/defs'
import { LabelsEvt, Sequencer } from '../src/sequencer'
import { Outbox } from '../src/sequencer/outbox'

describe('sequencer', () => {
  let network: TestNetwork
  let sequencer: Sequencer

  let totalEvts = 0
  let lastSeen: number

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'ozone_sequencer',
    })
    // @ts-expect-error
    sequencer = network.ozone.ctx.sequencer
  })

  afterAll(async () => {
    await network.close()
  })

  const loadFromDb = (lastSeen: number) => {
    return sequencer.db.db
      .selectFrom('label')
      .selectAll()
      .where('id', '>', lastSeen)
      .orderBy('id', 'asc')
      .execute()
  }

  const evtToDbRow = (e: LabelsEvt) => {
    const { ver: _, ...label } = e.labels[0]
    return {
      id: e.seq,
      ...label,
      neg: !!label.neg,
      cid: label.cid ? label.cid : '',
      exp: null,
      sig: label.sig ? Buffer.from(label.sig) : null,
      signingKeyId: network.ozone.ctx.signingKeyId,
    }
  }

  const caughtUp = (outbox: Outbox): (() => Promise<boolean>) => {
    return async () => {
      const lastEvt = await outbox.sequencer.curr()
      if (lastEvt === null) return true
      return outbox.lastSeen >= (lastEvt ?? 0)
    }
  }

  const createLabels = async (count: number): Promise<Label[]> => {
    const labels: Label[] = []
    for (let i = 0; i < count; i++) {
      const did = `did:example:${randomStr(10, 'base32')}`
      const label = {
        src: EXAMPLE_LABELER,
        uri: did,
        val: 'spam',
        neg: false,
        cts: new Date().toISOString(),
      }
      await network.ozone.ctx.db.transaction((dbTxn) =>
        network.ozone.ctx.modService(dbTxn).createLabels([label]),
      )
      labels.push(label)
    }
    return labels
  }

  it('sends to outbox', async () => {
    const count = 20
    totalEvts += count
    await createLabels(count)
    const outbox = new Outbox(sequencer)
    const evts = await readFromGenerator(outbox.events(-1), caughtUp(outbox))
    expect(evts.length).toBe(totalEvts)

    const fromDb = await loadFromDb(-1)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('sequences negative labels', async () => {
    const count = 5
    totalEvts += count
    const created = await createLabels(count)
    const toNegate = created
      .slice(0, 2)
      .map((l) => ({ ...l, neg: true, cts: new Date().toISOString() }))
    await network.ozone.ctx
      .modService(network.ozone.ctx.db)
      .createLabels(toNegate)

    const outbox = new Outbox(sequencer)
    const evts = await readFromGenerator(
      outbox.events(lastSeen),
      caughtUp(outbox),
    )
    expect(evts.length).toBe(count)

    const fromDb = await loadFromDb(lastSeen)
    expect(evts.map(evtToDbRow)).toEqual(fromDb)
    expect(evts[3].labels[0].uri).toEqual(toNegate[0].uri)
    expect(evts[3].labels[0].neg).toBe(true)
    expect(evts[4].labels[0].uri).toEqual(toNegate[1].uri)
    expect(evts[4].labels[0].neg).toBe(true)

    lastSeen = evts.at(-1)?.seq ?? lastSeen
  })

  it('handles cut over', async () => {
    const count = 20
    totalEvts += count
    const outbox = new Outbox(sequencer)
    const createPromise = createLabels(count)
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
    const createPromise = createLabels(count)
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
    const createPromise = createLabels(count)
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
    const createPromise = createLabels(count)
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
    lastSeen = fromDb.at(-1)?.id ?? lastSeen
  })

  it('handles many open connections', async () => {
    const count = 20
    const outboxes: Outbox[] = []
    for (let i = 0; i < 50; i++) {
      outboxes.push(new Outbox(sequencer))
    }
    const createPromise = createLabels(count)
    const readOutboxes = Promise.all(
      outboxes.map((o) =>
        readFromGenerator(o.events(lastSeen), caughtUp(o), createPromise),
      ),
    )
    const [results] = await Promise.all([readOutboxes, createPromise])
    const fromDb = await loadFromDb(lastSeen)
    for (const result of results) {
      expect(result.length).toBe(count)
      expect(result.map(evtToDbRow)).toEqual(fromDb)
    }
    lastSeen = results[0].at(-1)?.seq ?? lastSeen
  })
})

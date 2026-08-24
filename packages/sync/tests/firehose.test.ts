import { createDeferrable } from '@atproto/common'
import {
  type SeedClient,
  TestNetworkNoAppView,
  mockResolvers,
} from '@atproto/dev-env'
import { IdResolver } from '@atproto/identity'
import type { DidString } from '@atproto/syntax'
import {
  type Create,
  type Event,
  Firehose,
  type FirehoseOptions,
  MemoryRunner,
} from '../src/index.js'

describe('firehose', () => {
  let network: TestNetworkNoAppView
  let sc: SeedClient
  let idResolver: IdResolver

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'sync_firehose',
    })
    idResolver = new IdResolver({ plcUrl: network.plc.url })
    mockResolvers(idResolver, network.pds)
    sc = network.getSeedClient()
  })

  afterAll(async () => {
    await network?.close()
  })

  const createAndReadFirehose = async (
    isComplete: (events: Event[]) => boolean,
    opts: Partial<FirehoseOptions> = {},
  ): Promise<Event[]> => {
    const defer = createDeferrable()
    const evts: Event[] = []
    const firehose = new Firehose({
      idResolver,
      service: network.pds.url.replace('http', 'ws'),
      handleEvent: async (evt) => {
        evts.push(evt)
        if (isComplete(evts)) {
          defer.resolve()
        }
      },
      onError: (err) => {
        defer.reject(err)
      },
      ...opts,
    })
    try {
      firehose.start()
      await defer.complete
      return evts
    } finally {
      await firehose.destroy()
    }
  }

  let alice: DidString

  it('reads events from firehose', async () => {
    const startCursor = (await network.pds.ctx.sequencer.curr()) ?? 0
    const runner = new MemoryRunner({ startCursor })
    const evtsPromise = createAndReadFirehose((events) => events.length >= 6, {
      runner,
    })
    const aliceRes = await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    alice = aliceRes.did
    await sc.post(alice, 'one')
    await sc.post(alice, 'two')
    await sc.post(alice, 'three')

    const evts = await evtsPromise
    expect(evts.length).toBe(6)
    expect(evts.at(0)).toMatchObject({
      event: 'identity',
      did: alice,
      handle: aliceRes.handle,
      didDocument: {
        id: alice,
      },
    })
    expect(evts.at(1)).toMatchObject({
      event: 'account',
      did: alice,
      active: true,
      status: undefined,
    })
    expect(evts.at(2)).toMatchObject({
      event: 'sync',
      did: alice,
    })
    expect(evts.at(3)).toMatchObject({
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'one',
      },
    })
    expect(evts.at(4)).toMatchObject({
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'two',
      },
    })
    expect(evts.at(5)).toMatchObject({
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'three',
      },
    })
  })

  it('does not naively pass through invalid handle evts', async () => {
    const startCursor = (await network.pds.ctx.sequencer.curr()) ?? 0
    const runner = new MemoryRunner({ startCursor })
    const evtsPromise = createAndReadFirehose((events) => events.length >= 1, {
      runner,
    })
    await network.pds.ctx.sequencer.sequenceIdentity(alice, 'bad-handle.test')
    const evts = await evtsPromise
    expect(evts.at(0)).toMatchObject({ handle: 'alice.test' })
  })

  it('processes events through the sync queue', async () => {
    const currCursor = await network.pds.ctx.sequencer.curr()
    const runner = new MemoryRunner({
      startCursor: currCursor ?? undefined,
    })
    const userDids = new Set<DidString>()
    const evtsPromise = createAndReadFirehose(
      (events) =>
        userDids.size === 4 &&
        [...userDids].every(
          (did) => events.filter((event) => event.did === did).length >= 6,
        ),
      { runner },
    )
    const createAndPost = async (name: string) => {
      const user = await sc.createAccount('name', {
        handle: `${name}.test`,
        email: `${name}@example.com`,
        password: `${name}-pass`,
      })
      const did = user.did
      userDids.add(did)
      const post1 = await sc.post(did, 'one')
      const post2 = await sc.post(did, 'two')
      const post3 = await sc.post(did, 'three')
      return {
        did,
        post1: post1.ref.uriStr,
        post2: post2.ref.uriStr,
        post3: post3.ref.uriStr,
      }
    }
    const res = await Promise.all([
      createAndPost('user1'),
      createAndPost('user2'),
      createAndPost('user3'),
      createAndPost('user4'),
    ])
    const evts = await evtsPromise
    const user1Evts = evts.filter((e) => e.did === res[0].did)
    const user2Evts = evts.filter((e) => e.did === res[1].did)
    const user3Evts = evts.filter((e) => e.did === res[2].did)
    const user4Evts = evts.filter((e) => e.did === res[3].did)
    const EVT_ORDER = [
      'identity',
      'account',
      'sync',
      'create',
      'create',
      'create',
    ]
    expect(user1Evts.map((e) => e.event)).toEqual(EVT_ORDER)
    expect(user2Evts.map((e) => e.event)).toEqual(EVT_ORDER)
    expect(user3Evts.map((e) => e.event)).toEqual(EVT_ORDER)
    expect(user4Evts.map((e) => e.event)).toEqual(EVT_ORDER)
    expect(
      user1Evts.slice(3, 6).map((e) => (e as Create).uri.toString()),
    ).toEqual([res[0].post1, res[0].post2, res[0].post3])
    expect(
      user2Evts.slice(3, 6).map((e) => (e as Create).uri.toString()),
    ).toEqual([res[1].post1, res[1].post2, res[1].post3])
    expect(
      user3Evts.slice(3, 6).map((e) => (e as Create).uri.toString()),
    ).toEqual([res[2].post1, res[2].post2, res[2].post3])
    expect(
      user4Evts.slice(3, 6).map((e) => (e as Create).uri.toString()),
    ).toEqual([res[3].post1, res[3].post2, res[3].post3])
  })
})

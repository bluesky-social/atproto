import {
  mockResolvers,
  SeedClient,
  TestNetworkNoAppView,
} from '@atproto/dev-env'
import { Firehose, FirehoseOptions } from '../src'
import { IdResolver } from '@atproto/identity'
import { Event } from '../src/events'
import { wait } from '@atproto/common'

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
    await network.close()
  })

  const createFirehose = async (opts?: FirehoseOptions) => {
    const firehose = new Firehose({
      idResolver,
      service: network.pds.url.replace('http', 'ws'),
      onError: (_, err) => {
        throw err
      },
      ...(opts ?? {}),
    })
    await wait(5) // give the websocket just a second to spin up
    return firehose
  }

  const readEvts = async (
    firehose: Firehose,
    count: number,
  ): Promise<Event[]> => {
    const evts: Event[] = []
    for await (const evt of firehose) {
      evts.push(evt)
      if (evts.length >= count) break
    }
    return evts
  }

  let alice: string

  it('reads events from firehose', async () => {
    const firehose = await createFirehose()
    const evtsPromise = readEvts(firehose, 5)
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
    expect(evts.length).toBe(5)
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
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'one',
      },
    })
    expect(evts.at(3)).toMatchObject({
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'two',
      },
    })
    expect(evts.at(4)).toMatchObject({
      event: 'create',
      did: alice,
      collection: 'app.bsky.feed.post',
      record: {
        text: 'three',
      },
    })
  })

  it('does not naively pass through invalid handle evts', async () => {
    const firehose = await createFirehose()
    const evtsPromise = readEvts(firehose, 1)
    await wait(5)
    await network.pds.ctx.sequencer.sequenceIdentityEvt(
      alice,
      'bad-handle.test',
    )
    const evts = await evtsPromise
    expect(evts.at(0)).toMatchObject({ handle: 'alice.test' })
  })
})

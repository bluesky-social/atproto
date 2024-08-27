import { SeedClient, TestNetwork } from '@atproto/dev-env'
import { Firehose, SyncQueue } from '../src'

describe('firehose', () => {
  let network: TestNetwork
  let sc: SeedClient

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'sync_firehose',
    })
    sc = network.getSeedClient()
  })

  afterAll(async () => {
    await network.close()
  })

  it('works', async () => {
    // const syncQueue = new SyncQueue({
    //   handleEvt: async (evt) => {
    //     console.log(evt)
    //   },
    // })
    const firehose = new Firehose({
      service: network.pds.url.replace('http', 'ws'),
      onError: (typ, err) => {
        console.log('typ: ', typ)
        console.log('ERR: ', err)
      },
    })
    const read = async () => {
      for await (const evt of firehose) {
        console.log('got evt')
      }
    }
    read()
    // syncQueue.consumeFirehose(firehose)
    const alice = await sc.createAccount('alice', {
      handle: 'alice.test',
      email: 'alice@test.com',
      password: 'alice-pass',
    })
    await sc.post(alice.did, 'one')
    await sc.post(alice.did, 'two')
    await sc.post(alice.did, 'three')
    // await syncQueue.processAll()
    await firehose.destroy()
    read()
    // await syncQueue.repoQueue.destroy()
  })
})

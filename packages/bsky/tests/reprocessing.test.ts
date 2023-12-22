import axios from 'axios'
import { AtUri } from '@atproto/syntax'
import { TestNetwork, SeedClient, basicSeed } from '@atproto/dev-env'
import { Database } from '../src/db'

describe('reprocessing', () => {
  let network: TestNetwork
  let sc: SeedClient
  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_reprocessing',
    })
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getRecordUris = async (db: Database, did: string) => {
    const res = await db.db
      .selectFrom('record')
      .select('uri')
      .where('did', '=', did)
      .execute()
    return res.map((row) => row.uri)
  }
  it('reprocesses repo data', async () => {
    const db = network.bsky.ctx.db.getPrimary()
    const urisBefore = await getRecordUris(db, alice)
    await db.db.deleteFrom('record').where('did', '=', alice).execute()
    const indexerPort = network.bsky.indexer.ctx.cfg.indexerPort
    await axios.post(`http://localhost:${indexerPort}/reprocess/${alice}`)
    await network.processAll()
    const urisAfter = await getRecordUris(db, alice)
    expect(urisAfter.sort()).toEqual(urisBefore.sort())
  })

  it('buffers commits while reprocessing repo data', async () => {
    const db = network.bsky.ctx.db.getPrimary()
    const urisBefore = await getRecordUris(db, alice)
    await db.db.deleteFrom('record').where('did', '=', alice).execute()
    const indexerPort = network.bsky.indexer.ctx.cfg.indexerPort
    const toDeleteIndex = urisBefore.findIndex((uri) =>
      uri.includes('app.bsky.feed.post'),
    )
    if (toDeleteIndex < 0) {
      throw new Error('could not find post to delete')
    }
    // request reprocess while buffering a new post & delete
    const [newPost] = await Promise.all([
      sc.post(alice, 'blah blah'),
      axios.post(`http://localhost:${indexerPort}/reprocess/${alice}`),
      sc.deletePost(alice, new AtUri(urisBefore[toDeleteIndex])),
    ])
    await network.processAll()
    const urisAfter = await getRecordUris(db, alice)
    const expected = [
      ...urisBefore.slice(0, toDeleteIndex),
      ...urisBefore.slice(toDeleteIndex + 1),
      newPost.ref.uriStr,
    ]
    expect(urisAfter.sort()).toEqual(expected.sort())
  })
})

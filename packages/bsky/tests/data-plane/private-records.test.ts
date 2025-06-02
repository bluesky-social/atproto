import AtpAgent from '@atproto/api'
import { SeedClient, TestNetwork, basicSeed } from '@atproto/dev-env'
import * as lex from '../../src/lexicon/lexicons'

type Database = TestNetwork['bsky']['db']

describe('private records', () => {
  let network: TestNetwork
  let db: Database
  let agent: AtpAgent
  let sc: SeedClient

  let alice: string

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_private_records',
    })
    db = network.bsky.db
    agent = network.bsky.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    await network.processAll()
    alice = sc.dids.alice
  })

  afterAll(async () => {
    await network.close()
  })

  it('inserts private records', async () => {
    const actorDid = alice
    const collection = 'com.test.dummy'
    const rkey = 'self'

    const { data } = await agent.app.bsky.unspecced.applyPrivateWrite(
      {
        write: {
          $type: 'app.bsky.unspecced.applyPrivateWrite#create',
          collection,
          rkey,
          value: {
            $type: 'app.bsky.unspecced.test#dummy',
            text: 'hello',
          },
        },
      },
      {
        headers: await network.serviceHeaders(
          alice,
          lex.ids.AppBskyUnspeccedApplyPrivateWrite,
        ),
      },
    )
    await network.processAll()

    expect(data.result).toStrictEqual({
      $type: 'app.bsky.unspecced.applyPrivateWrite#createResult',
      rkey,
    })

    const uri = `at://${actorDid}/${collection}/${rkey}`
    const dbResult = await db.db
      .selectFrom('private_record')
      .selectAll()
      .where('uri', '=', uri)
      .executeTakeFirstOrThrow()

    expect(dbResult).toStrictEqual({
      uri,
      actorDid,
      collection,
      rkey,
      payload: JSON.stringify({
        $type: 'app.bsky.unspecced.test#dummy',
        text: 'hello',
      }),
      indexedAt: expect.any(String),
    })
  })
})

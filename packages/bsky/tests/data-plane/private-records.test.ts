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

  const collection = 'com.test.dummy'
  const rkey = 'self'

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

  afterEach(async () => {
    await clearPrivateRecords(db)
  })

  afterAll(async () => {
    await network.close()
  })

  describe('create', () => {
    it('creates record', async () => {
      const actorDid = alice

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
            actorDid,
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

  describe('delete', () => {
    it('deletes record', async () => {
      const actorDid = alice

      await agent.app.bsky.unspecced.applyPrivateWrite(
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
            actorDid,
            lex.ids.AppBskyUnspeccedApplyPrivateWrite,
          ),
        },
      )
      await network.processAll()

      const { data } = await agent.app.bsky.unspecced.applyPrivateWrite(
        {
          write: {
            $type: 'app.bsky.unspecced.applyPrivateWrite#delete',
            collection,
            rkey,
          },
        },
        {
          headers: await network.serviceHeaders(
            actorDid,
            lex.ids.AppBskyUnspeccedApplyPrivateWrite,
          ),
        },
      )
      await network.processAll()

      expect(data.result).toStrictEqual({
        $type: 'app.bsky.unspecced.applyPrivateWrite#deleteResult',
        rkey,
      })

      const uri = `at://${actorDid}/${collection}/${rkey}`
      const dbResult = await db.db
        .selectFrom('private_record')
        .selectAll()
        .where('uri', '=', uri)
        .executeTakeFirst()
      expect(dbResult).toBe(undefined)
    })
  })
})

const clearPrivateRecords = async (db: Database) => {
  await db.db.deleteFrom('private_record').execute()
}

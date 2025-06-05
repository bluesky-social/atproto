import { TestNetwork } from '@atproto/dev-env'
import { StashClient } from '../../dist/stash'

type Database = TestNetwork['bsky']['db']

describe('private data', () => {
  let network: TestNetwork
  let stashClient: StashClient
  let db: Database

  const actorDid = 'did:plc:example'
  const namespace = 'com.test.defs#preferences'
  const key = 'self'

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_private_data',
    })
    db = network.bsky.db
    stashClient = network.bsky.ctx.stashClient
  })

  afterEach(async () => {
    await clearPrivateData(db)
  })

  afterAll(async () => {
    await network.close()
  })

  describe('create', () => {
    it('creates entry', async () => {
      await stashClient.create({
        actorDid,
        namespace,
        key,
        payload: { theme: 'light' },
      })
      await network.processAll()

      const dbResult = await db.db
        .selectFrom('private_data')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .where('namespace', '=', namespace)
        .where('key', '=', key)
        .executeTakeFirstOrThrow()
      expect(dbResult).toStrictEqual({
        actorDid,
        namespace,
        key,
        payload: JSON.stringify({ theme: 'light' }),
        indexedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })
  })

  describe('update', () => {
    it('updates entry', async () => {
      await stashClient.create({
        actorDid,
        namespace,
        key,
        payload: { theme: 'light' },
      })
      await network.processAll()

      await stashClient.update({
        actorDid,
        namespace,
        key,
        payload: { theme: 'dark' },
      })
      await network.processAll()

      const dbResult = await db.db
        .selectFrom('private_data')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .where('namespace', '=', namespace)
        .where('key', '=', key)
        .executeTakeFirstOrThrow()
      expect(dbResult).toStrictEqual({
        actorDid,
        namespace,
        key,
        payload: JSON.stringify({ theme: 'dark' }),
        indexedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })
  })

  describe('delete', () => {
    it('deletes entry', async () => {
      await stashClient.create({
        actorDid,
        namespace,
        key,
        payload: { theme: 'light' },
      })
      await network.processAll()

      await stashClient.delete({
        actorDid,
        namespace,
        key,
      })
      await network.processAll()

      const dbResult = await db.db
        .selectFrom('private_data')
        .selectAll()
        .where('actorDid', '=', actorDid)
        .where('namespace', '=', namespace)
        .where('key', '=', key)
        .executeTakeFirst()
      expect(dbResult).toBe(undefined)
    })
  })
})

const clearPrivateData = async (db: Database) => {
  await db.db.deleteFrom('private_data').execute()
}

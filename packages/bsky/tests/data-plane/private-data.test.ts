import { TestNetwork } from '@atproto/dev-env'
import { VaultClient } from '../../dist/vault'

type Database = TestNetwork['bsky']['db']

describe('private data', () => {
  let network: TestNetwork
  let vaultClient: VaultClient
  let db: Database

  const actorDid = 'did:plc:example'
  const namespace = 'com.test.defs#preferences'
  const key = 'self'

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_private_data',
    })
    db = network.bsky.db
    vaultClient = network.bsky.ctx.vaultClient
  })

  afterEach(async () => {
    await clearPrivateData(db)
  })

  afterAll(async () => {
    await network.close()
  })

  describe('create', () => {
    it('creates entry', async () => {
      await vaultClient.create({
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
      await vaultClient.create({
        actorDid,
        namespace,
        key,
        payload: { theme: 'light' },
      })
      await network.processAll()

      await vaultClient.update({
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
      await vaultClient.create({
        actorDid,
        namespace,
        key,
        payload: { theme: 'light' },
      })
      await network.processAll()

      await vaultClient.delete({
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

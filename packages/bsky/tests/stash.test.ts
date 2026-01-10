import { TestNetwork } from '@atproto/dev-env'
import { ProfileAssociatedChat } from '../dist/lexicon/types/app/bsky/actor/defs'
import { StashClient } from '../dist/stash'
import { Namespace } from '../src/stash'

type Database = TestNetwork['bsky']['db']

describe('private data', () => {
  let network: TestNetwork
  let stashClient: StashClient
  let db: Database

  const actorDid = 'did:plc:example'
  // This lexicon has nothing special other than being simple, convenient to use in a test.
  const namespace = 'app.bsky.actor.defs#profileAssociatedChat' as Namespace
  const key = 'self'

  const validPayload0: ProfileAssociatedChat = { allowIncoming: 'all' }
  const validPayload1: ProfileAssociatedChat = { allowIncoming: 'following' }
  const invalidPayload: ProfileAssociatedChat = {
    invalid: 'all',
  } as unknown as ProfileAssociatedChat

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
        payload: validPayload0,
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
        payload: JSON.stringify({ $type: namespace, ...validPayload0 }),
        indexedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('validates lexicon', async () => {
      expect(() =>
        stashClient.create({
          actorDid,
          namespace,
          key,
          payload: invalidPayload,
        }),
      ).toThrow('Object must have the property "allowIncoming"')
    })
  })

  describe('update', () => {
    it('updates entry', async () => {
      await stashClient.create({
        actorDid,
        namespace,
        key,
        payload: validPayload0,
      })
      await network.processAll()

      await stashClient.update({
        actorDid,
        namespace,
        key,
        payload: validPayload1,
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
        payload: JSON.stringify({ $type: namespace, ...validPayload1 }),
        indexedAt: expect.any(String),
        updatedAt: expect.any(String),
      })
    })

    it('validates lexicon', async () => {
      expect(() =>
        stashClient.update({
          actorDid,
          namespace,
          key,
          payload: invalidPayload,
        }),
      ).toThrow('Object must have the property "allowIncoming"')
    })
  })

  describe('delete', () => {
    it('deletes entry', async () => {
      await stashClient.create({
        actorDid,
        namespace,
        key,
        payload: validPayload0,
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

import { TestNetwork } from '@atproto/dev-env'
import { LexMap, lexStringify } from '@atproto/lex'
import { StashClient } from '../dist/stash'
import { app } from '../src/lexicons/index.js'
import { Namespaces } from '../src/stash'

type Database = TestNetwork['bsky']['db']

const FAKE_CID_1 = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq'
const FAKE_CID_2 = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq'

describe('private data', () => {
  let network: TestNetwork
  let stashClient: StashClient
  let db: Database

  const actorDid = 'did:plc:example'
  // Using bookmark namespace which is available in Namespaces
  const namespace = Namespaces.AppBskyBookmarkDefsBookmark
  const key = 'self'

  const validPayload0: app.bsky.bookmark.defs.Bookmark = {
    subject: {
      uri: 'at://did:plc:example/app.bsky.feed.post/1',
      cid: FAKE_CID_1,
    },
  }
  const validPayload1: app.bsky.bookmark.defs.Bookmark = {
    subject: {
      uri: 'at://did:plc:example/app.bsky.feed.post/2',
      cid: FAKE_CID_2,
    },
  }
  const invalidPayload: LexMap = {
    invalid: 'all',
  }

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
        .where('namespace', '=', namespace.$type)
        .where('key', '=', key)
        .executeTakeFirstOrThrow()
      expect(dbResult).toStrictEqual({
        actorDid,
        namespace: namespace.$type,
        key,
        payload: lexStringify(
          app.bsky.bookmark.defs.bookmark.$build(validPayload0),
        ),
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
      ).toThrow(
        expect.objectContaining({
          message: expect.stringContaining('subject'),
        }),
      )
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
        .where('namespace', '=', namespace.$type)
        .where('key', '=', key)
        .executeTakeFirstOrThrow()
      expect(dbResult).toStrictEqual({
        actorDid,
        namespace: namespace.$type,
        key,
        payload: lexStringify(
          app.bsky.bookmark.defs.bookmark.$build(validPayload1),
        ),
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
      ).toThrow(
        expect.objectContaining({
          name: 'LexValidationError',
        }),
      )
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
        .where('namespace', '=', namespace.$type)
        .where('key', '=', key)
        .executeTakeFirst()
      expect(dbResult).toBe(undefined)
    })
  })
})

const clearPrivateData = async (db: Database) => {
  await db.db.deleteFrom('private_data').execute()
}

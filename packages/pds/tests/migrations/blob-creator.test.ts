import { Database } from '../../src'
import { randomStr } from '@atproto/crypto'
import { cidForCbor, TID } from '@atproto/common'
import { Kysely } from 'kysely'
import { AtUri } from '@atproto/uri'

describe('blob creator migration', () => {
  let db: Database
  let rawDb: Kysely<any>

  beforeAll(async () => {
    if (process.env.DB_POSTGRES_URL) {
      db = Database.postgres({
        url: process.env.DB_POSTGRES_URL,
        schema: 'migration_blob_creator',
      })
    } else {
      db = Database.memory()
    }
    await db.migrateToOrThrow('_20230310T205728933Z')

    rawDb = db.db
  })

  afterAll(async () => {
    await db.close()
  })

  const dids = ['did:example:alice', 'did:example:bob', 'did:example:carol']
  const getCidStr = async () => {
    const cid = await cidForCbor({ test: randomStr(20, 'base32') })
    return cid.toString()
  }

  const repoBlob = async (did: string, cid: string) => {
    const uri = AtUri.make(did, 'com.atproto.collection', TID.nextStr())
    return {
      cid,
      recordUri: uri.toString(),
      commit: await getCidStr(),
      did,
      takedownId: null,
    }
  }

  let blobsSnap
  let repoBlobsSnap

  it('creates a some blobs', async () => {
    const blobs: any[] = []
    const repoBlobs: any[] = []
    for (let i = 0; i < 1000; i++) {
      const cid = await getCidStr()
      blobs.push({
        cid,
        mimeType: 'image/jpeg',
        size: Math.floor(Math.random() * 1000000),
        tempKey: null,
        width: Math.floor(Math.random() * 1000),
        height: Math.floor(Math.random() * 1000),
        createdAt: new Date().toISOString(),
      })
      if (i % 2 === 0) {
        repoBlobs.push(await repoBlob(dids[0], cid))
      } else {
        repoBlobs.push(await repoBlob(dids[1], cid))
      }

      if (i % 5 === 0) {
        repoBlobs.push(await repoBlob(dids[2], cid))
      }
    }
    await rawDb.insertInto('blob').values(blobs).execute()
    await rawDb.insertInto('repo_blob').values(repoBlobs).execute()

    blobsSnap = await rawDb
      .selectFrom('blob')
      .selectAll()
      .orderBy('cid')
      .execute()
    repoBlobsSnap = await rawDb
      .selectFrom('repo_blob')
      .selectAll()
      .orderBy('cid')
      .orderBy('did')
      .execute()
  })

  it('migrates up', async () => {
    const migration = await db.migrator.migrateTo('_20230313T232322844Z')
    expect(migration.error).toBeUndefined()
  })

  it('correctly migrated data', async () => {
    const blobs = await rawDb
      .selectFrom('blob')
      .selectAll()
      .orderBy('cid')
      .orderBy('creator')
      .execute()
    const repoBlobs = await rawDb
      .selectFrom('repo_blob')
      .selectAll()
      .orderBy('cid')
      .orderBy('did')
      .execute()

    expect(blobs.length).toBe(repoBlobs.length)
    expect(repoBlobs.length).toBe(repoBlobsSnap.length)

    for (const blob of blobs) {
      const snapped = blobsSnap.find((b) => b.cid === blob.cid)
      const { creator, ...rest } = blob
      expect(snapped).toEqual(rest)
      const found = repoBlobsSnap.find(
        (b) => b.cid === blob.cid && b.did === creator,
      )
      expect(found).toBeDefined()
    }
  })

  it('migrates down', async () => {
    const migration = await db.migrator.migrateTo('_20230310T205728933Z')
    expect(migration.error).toBeUndefined()

    const updatedBlobs = await rawDb
      .selectFrom('blob')
      .selectAll()
      .orderBy('cid')
      .execute()
    const updatedRepoBlobs = await rawDb
      .selectFrom('repo_blob')
      .selectAll()
      .orderBy('cid')
      .orderBy('did')
      .execute()

    expect(updatedBlobs).toEqual(blobsSnap)
    expect(updatedRepoBlobs).toEqual(repoBlobsSnap)
  })
})

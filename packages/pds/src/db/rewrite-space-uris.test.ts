import { sql } from 'kysely'
import * as accountDb from '../account-manager/db/index.js'
import * as actorDb from '../actor-store/db/index.js'

const OLD_SPACE = 'at://did:plc:authority/space/com.example.group/default'
const NEW_SPACE = 'at:space/did:plc:authority/com.example.group/default'
const RECORD_PATH = 'did:plc:writer/com.example.post/3kbcq3p7ad401'
const OLD_RECORD = `${OLD_SPACE}/${RECORD_PATH}`
const NEW_RECORD = `${NEW_SPACE}/${RECORD_PATH}`
// Only the marker after the space DID moves, not an skey that reads "space".
const OLD_SPACE_SKEY =
  'at://did:web:localhost%3A2583/space/com.example.group/space'
const NEW_SPACE_SKEY =
  'at:space/did:web:localhost%3A2583/com.example.group/space'

const bytes = new Uint8Array([1, 2, 3])

/**
 * The migrations run against an in-memory sqlite store: data is written in the
 * old URI form at the migration before, then migrated up and back down.
 */
describe('space URI migrations', () => {
  describe('actor store', () => {
    let db: actorDb.ActorDb

    beforeAll(async () => {
      db = actorDb.getDb(':memory:')
      await actorDb.getMigrator(db).migrateToOrThrow('009')
      await sql`
        insert into space (uri, authority, type, createdAt)
        values
          (${OLD_SPACE}, 'did:plc:authority', 'com.example.group', ''),
          (${OLD_SPACE_SKEY}, 'did:web:localhost%3A2583', 'com.example.group', '')
      `.execute(db.db)
      await sql`
        insert into space_policy (uri, policyJson) values (${OLD_SPACE}, '{}')
      `.execute(db.db)
      await sql`
        insert into memberspace_member (space, did)
        values (${OLD_SPACE}, 'did:plc:writer')
      `.execute(db.db)
      await sql`
        insert into space_record (
          uri, space, collection, rkey, cid, value, repoRev, indexedAt
        )
        values (
          ${OLD_RECORD}, ${OLD_SPACE}, 'com.example.post', '3kbcq3p7ad401',
          'cid', ${bytes}, 'rev', ''
        )
      `.execute(db.db)
      // blob2 is already in the new form, as if a run had stopped part-way: the
      // rewrite must leave it as it is.
      await sql`
        insert into space_record_blob (blobCid, recordUri)
        values ('blob1', ${OLD_RECORD}), ('blob2', ${NEW_RECORD})
      `.execute(db.db)
      await sql`
        insert into space_repo (space, setHash, rev)
        values (${OLD_SPACE}, ${bytes}, 'rev')
      `.execute(db.db)
      await sql`
        insert into space_record_oplog (
          space, rev, idx, action, uri, collection, rkey
        )
        values (
          ${OLD_SPACE}, 'rev', 0, 'create', ${OLD_RECORD}, 'com.example.post',
          '3kbcq3p7ad401'
        )
      `.execute(db.db)
      // 010-space-remodel's down() derives the oplog's record uris from it.
      await sql`
        insert into repo_root (did, cid, rev, indexedAt)
        values ('did:plc:writer', 'cid', 'rev', '')
      `.execute(db.db)
      await sql`
        insert into space_writer (space, did, repoRev, data)
        values (${OLD_SPACE}, 'did:plc:writer', 'rev', ${bytes})
      `.execute(db.db)
      await sql`
        insert into space_notify_registration (space, endpoint, token, expiresAt)
        values (${OLD_SPACE}, 'https://syncer.test', 'token', '')
      `.execute(db.db)
    })

    afterAll(async () => {
      await db?.close()
    })

    it('rewrites every stored space URI to the new form', async () => {
      await actorDb.getMigrator(db).migrateToLatestOrThrow()
      await expect(readActorUris(db)).resolves.toEqual({
        space: [NEW_SPACE, NEW_SPACE_SKEY],
        policy: [NEW_SPACE],
        member: [NEW_SPACE],
        record: [[NEW_RECORD, NEW_SPACE]],
        recordBlob: [NEW_RECORD, NEW_RECORD],
        repo: [NEW_SPACE],
        oplog: [NEW_SPACE],
        writer: [NEW_SPACE],
        notifyRegistration: [NEW_SPACE],
      })
    })

    it('rewrites them back to the old form on the way down', async () => {
      await actorDb.getMigrator(db).migrateToOrThrow('009')
      await expect(readActorUris(db)).resolves.toEqual({
        space: [OLD_SPACE, OLD_SPACE_SKEY],
        policy: [OLD_SPACE],
        member: [OLD_SPACE],
        record: [[OLD_RECORD, OLD_SPACE]],
        recordBlob: [OLD_RECORD, OLD_RECORD],
        repo: [OLD_SPACE],
        oplog: [OLD_SPACE],
        writer: [OLD_SPACE],
        notifyRegistration: [OLD_SPACE],
      })
      // 010-space-remodel dropped the oplog's record uris, and restores them
      // from the space, once 011 has moved it back to the old form.
      const { rows } = await sql<{
        uri: string
      }>`select uri from space_record_oplog`.execute(db.db)
      expect(rows).toEqual([{ uri: OLD_RECORD }])
    })
  })

  describe('account db', () => {
    let db: accountDb.AccountDb

    beforeAll(async () => {
      db = accountDb.getDb(':memory:')
      await accountDb.getMigrator(db).migrateToOrThrow('012')
      await sql`
        insert into space_notification_retry (
          repo, space, repoRev, data, attempts, retryAt, expiresAt
        )
        values ('did:plc:writer', ${OLD_SPACE}, 'rev', ${bytes}, 1, 0, 0)
      `.execute(db.db)
      await sql`
        insert into revoked_space_credential (space, jti, expiresAt)
        values (${OLD_SPACE}, 'jti', '')
      `.execute(db.db)
      await sql`
        insert into space_syncer_notification_retry (
          space, endpoint, token, noticeJson, attempts, retryAt, expiresAt
        )
        values (${OLD_SPACE}, 'https://syncer.test', 'token', '{}', 1, 0, 0)
      `.execute(db.db)
    })

    afterAll(async () => {
      await db?.close()
    })

    it('rewrites every stored space URI to the new form', async () => {
      await accountDb.getMigrator(db).migrateToLatestOrThrow()
      await expect(readAccountUris(db)).resolves.toEqual([
        NEW_SPACE,
        NEW_SPACE,
        NEW_SPACE,
      ])
    })

    it('rewrites them back to the old form on the way down', async () => {
      await accountDb.getMigrator(db).migrateToOrThrow('012')
      await expect(readAccountUris(db)).resolves.toEqual([
        OLD_SPACE,
        OLD_SPACE,
        OLD_SPACE,
      ])
    })
  })
})

async function readActorUris(db: actorDb.ActorDb) {
  const col = async (query: string) =>
    (await sql.raw<Record<string, string>>(query).execute(db.db)).rows.map(
      (row) => {
        const values = Object.values(row)
        return values.length === 1 ? values[0] : values
      },
    )
  return {
    space: await col('select uri from space order by createdAt, rowid'),
    policy: await col('select uri from space_policy'),
    member: await col('select space from memberspace_member'),
    record: await col('select uri, space from space_record'),
    recordBlob: await col(
      'select recordUri from space_record_blob order by blobCid',
    ),
    repo: await col('select space from space_repo'),
    oplog: await col('select space from space_record_oplog'),
    writer: await col('select space from space_writer'),
    notifyRegistration: await col(
      'select space from space_notify_registration',
    ),
  }
}

async function readAccountUris(db: accountDb.AccountDb) {
  const { rows } = await sql<{ space: string }>`
    select space from space_notification_retry
    union all select space from revoked_space_credential
    union all select space from space_syncer_notification_retry
  `.execute(db.db)
  return rows.map((row) => row.space)
}

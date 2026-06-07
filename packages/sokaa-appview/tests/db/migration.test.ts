import { sql } from 'kysely'
import { Database, DatabaseSchema } from '../../src/data-plane/server/db'

/**
 * Schema contract for the Sokaa AppView dataplane database.
 *
 * Runs in CI on every PR via the monorepo Test job (with-test-db.sh → Docker
 * Postgres). Any migration or schema change must keep these assertions green.
 *
 * Conventions mirror packages/bsky (not the raw SQL in docs/):
 *  - singular table names (`actor`, `post`, `follow`, `like`)
 *  - camelCase, quoted column identifiers (`pdsEndpoint`, `indexedAt`)
 *  - timestamps stored as ISO-8601 strings in `varchar` columns (lexicographic
 *    sort == chronological, given ingestion normalizes to ms-precision `Z`),
 *    matching bsky and PDF §8.3.
 *  - no FK constraints between records (firehose events arrive out of order).
 */

// Expected columns and their information_schema data_type per table.
const EXPECTED_COLUMNS: Record<string, Record<string, string>> = {
  actor: {
    did: 'character varying',
    handle: 'character varying',
    pdsEndpoint: 'character varying',
    displayName: 'character varying',
    description: 'character varying',
    avatarCid: 'character varying',
    bannerCid: 'character varying',
    followersCount: 'integer',
    postsCount: 'integer',
    upstreamStatus: 'character varying',
    indexedAt: 'character varying',
  },
  post: {
    uri: 'character varying',
    cid: 'character varying',
    creator: 'character varying',
    caption: 'character varying',
    mediaType: 'character varying',
    mediaJson: 'jsonb',
    likeCount: 'integer',
    createdAt: 'character varying',
    indexedAt: 'character varying',
  },
  follow: {
    uri: 'character varying',
    creator: 'character varying',
    subjectDid: 'character varying',
    createdAt: 'character varying',
    indexedAt: 'character varying',
  },
  like: {
    uri: 'character varying',
    creator: 'character varying',
    subject: 'character varying',
    subjectCid: 'character varying',
    createdAt: 'character varying',
    indexedAt: 'character varying',
  },
  subscription_cursor: {
    id: 'integer',
    lastSeq: 'bigint',
    updatedAt: 'character varying',
  },
}

// Columns we expect to be index-backed (timeline + graph + like lookups).
const EXPECTED_INDEX_COLUMNS: Record<string, string[]> = {
  post: ['creator', 'createdAt'],
  follow: ['creator', 'subjectDid'],
  like: ['subject'],
}

describe('sokaa-appview db migrations', () => {
  const schema = 'sokaa_appview_migration_test'
  let database: Database
  let db: DatabaseSchema

  beforeAll(async () => {
    const url = process.env.DB_POSTGRES_URL
    if (!url) throw new Error('Missing DB_POSTGRES_URL for migration tests')
    database = new Database({ url, schema, poolSize: 5 })
    db = database.db
    await db.schema.dropSchema(schema).ifExists().cascade().execute()
    await database.migrateToLatestOrThrow()
  })

  afterAll(async () => {
    if (database) {
      await database.db.schema.dropSchema(schema).ifExists().cascade().execute()
      await database.close()
    }
  })

  it('creates every expected table', async () => {
    const res = await sql<{ table_name: string }>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = ${schema}
    `.execute(db)
    const tables = res.rows.map((r) => r.table_name)
    for (const table of Object.keys(EXPECTED_COLUMNS)) {
      expect(tables).toContain(table)
    }
  })

  it('creates every expected column with the right type', async () => {
    for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
      const res = await sql<{ column_name: string; data_type: string }>`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = ${schema} AND table_name = ${table}
      `.execute(db)
      const actual = Object.fromEntries(
        res.rows.map((r) => [r.column_name, r.data_type]),
      )
      for (const [col, type] of Object.entries(columns)) {
        expect(actual[col]).toBe(type)
      }
    }
  })

  it('defaults counts to 0 and actor.upstreamStatus to active', async () => {
    const res = await sql<{ column_name: string; column_default: string }>`
      SELECT column_name, column_default FROM information_schema.columns
      WHERE table_schema = ${schema}
        AND table_name = 'actor'
        AND column_name IN ('followersCount', 'postsCount', 'upstreamStatus')
    `.execute(db)
    const defaults = Object.fromEntries(
      res.rows.map((r) => [r.column_name, r.column_default ?? '']),
    )
    expect(defaults['followersCount']).toContain('0')
    expect(defaults['postsCount']).toContain('0')
    expect(defaults['upstreamStatus']).toContain('active')
  })

  it('index-backs timeline, follow-graph, and like lookups', async () => {
    for (const [table, cols] of Object.entries(EXPECTED_INDEX_COLUMNS)) {
      const res = await sql<{ indexdef: string }>`
        SELECT indexdef FROM pg_indexes
        WHERE schemaname = ${schema} AND tablename = ${table}
      `.execute(db)
      const defs = res.rows.map((r) => r.indexdef)
      for (const col of cols) {
        expect(defs.some((d) => d.includes(col))).toBe(true)
      }
    }
  })

  it('enforces a single-row subscription_cursor', async () => {
    await sql`
      INSERT INTO subscription_cursor (id, "lastSeq", "updatedAt")
      VALUES (1, 100, '2026-01-01T00:00:00.000Z')
    `.execute(db)
    await expect(
      sql`
        INSERT INTO subscription_cursor (id, "lastSeq", "updatedAt")
        VALUES (2, 200, '2026-01-01T00:00:00.000Z')
      `.execute(db),
    ).rejects.toThrow()
  })

  it('enforces unique follows (creator + subjectDid)', async () => {
    await sql`
      INSERT INTO follow (uri, creator, "subjectDid", "createdAt", "indexedAt")
      VALUES ('at://did:a/app.sokaa.graph.follow/1', 'did:a', 'did:b',
              '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `.execute(db)
    await expect(
      sql`
        INSERT INTO follow (uri, creator, "subjectDid", "createdAt", "indexedAt")
        VALUES ('at://did:a/app.sokaa.graph.follow/2', 'did:a', 'did:b',
                '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
      `.execute(db),
    ).rejects.toThrow()
  })

  it('enforces unique likes (creator + subject)', async () => {
    await sql`
      INSERT INTO "like" (uri, creator, subject, "subjectCid", "createdAt", "indexedAt")
      VALUES ('at://did:a/app.sokaa.feed.like/1', 'did:a',
              'at://did:b/app.sokaa.feed.post/1', 'bafy1',
              '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `.execute(db)
    await expect(
      sql`
        INSERT INTO "like" (uri, creator, subject, "subjectCid", "createdAt", "indexedAt")
        VALUES ('at://did:a/app.sokaa.feed.like/2', 'did:a',
                'at://did:b/app.sokaa.feed.post/1', 'bafy1',
                '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
      `.execute(db),
    ).rejects.toThrow()
  })

  it('round-trips an actor with default columns applied', async () => {
    await sql`
      INSERT INTO actor (did, handle, "pdsEndpoint", "indexedAt")
      VALUES ('did:plc:rt', 'rt.test', 'https://pds.test',
              '2026-01-01T00:00:00.000Z')
    `.execute(db)
    const res = await sql<{
      handle: string
      followersCount: number
      postsCount: number
      upstreamStatus: string
    }>`
      SELECT handle, "followersCount", "postsCount", "upstreamStatus"
      FROM actor WHERE did = 'did:plc:rt'
    `.execute(db)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].handle).toBe('rt.test')
    expect(res.rows[0].followersCount).toBe(0)
    expect(res.rows[0].postsCount).toBe(0)
    expect(res.rows[0].upstreamStatus).toBe('active')
  })

  it('round-trips a media post (no actor FK required)', async () => {
    await sql`
      INSERT INTO post (uri, cid, creator, caption, "mediaType", "mediaJson",
                        "createdAt", "indexedAt")
      VALUES ('at://did:plc:rt/app.sokaa.feed.post/1', 'bafypost', 'did:plc:rt',
              'hello', 'video', '{"playlist":"x"}',
              '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `.execute(db)
    const res = await sql<{
      caption: string
      mediaType: string
      likeCount: number
    }>`
      SELECT caption, "mediaType", "likeCount"
      FROM post WHERE uri = 'at://did:plc:rt/app.sokaa.feed.post/1'
    `.execute(db)
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].caption).toBe('hello')
    expect(res.rows[0].mediaType).toBe('video')
    expect(res.rows[0].likeCount).toBe(0)
  })
})

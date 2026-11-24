import SqliteDB from 'better-sqlite3'
import { type CompiledQuery, Kysely, SqliteDialect } from 'kysely'
import { encode } from '@atproto/lex-cbor'
import { cidForCbor } from '@atproto/lex-data'
import { type BlobStore, WriteOpAction } from '@atproto/repo'
import type { DidString, NsidString, SpaceRef } from '@atproto/syntax'
import { BlobTransactor } from '../../src/actor-store/blob/transactor.js'
import {
  type ActorDb,
  type DatabaseSchema,
  getMigrator,
} from '../../src/actor-store/db/index.js'
import { SpaceTransactor } from '../../src/actor-store/space/transactor.js'
import type { BackgroundQueue } from '../../src/background.js'
import { Database } from '../../src/db/index.js'
import type { PreparedCreate } from '../../src/repo/types.js'

// The store belongs to ACTOR_DID, which writes to spaces of SPACE_DID, so a write
// creates the repo without the space having to exist first.
export const SPACE_DID = 'did:example:authority' as DidString
export const ACTOR_DID = 'did:example:alice' as DidString

export type SpaceTestDb = {
  sqlite: SqliteDB.Database
  db: ActorDb
  space: SpaceTransactor
  transact<T>(fn: (space: SpaceTransactor) => Promise<T>): Promise<T>
  queries: CompiledQuery[]
  deletedFromBlobstore: string[]
  plan(q: CompiledQuery): string[]
  close(): Promise<void>
}

/** An in-memory, migrated actor store, logging the queries run against it. */
export async function createSpaceTestDb(): Promise<SpaceTestDb> {
  const sqlite = new SqliteDB(':memory:')
  const queries: CompiledQuery[] = []
  const db: ActorDb = new Database(
    new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqlite }),
      log: (event) => {
        if (event.level === 'query') queries.push(event.query)
      },
    }),
  )
  await getMigrator(db).migrateToLatestOrThrow()

  const deletedFromBlobstore: string[] = []
  const blobstore = {
    async deleteMany(cids: { toString(): string }[]) {
      deletedFromBlobstore.push(...cids.map(String))
    },
  } as unknown as BlobStore
  const backgroundQueue = {
    add: async (fn: () => Promise<void>) => fn(),
  } as unknown as BackgroundQueue
  const transactorFor = (actorDb: ActorDb) =>
    new SpaceTransactor(
      ACTOR_DID,
      actorDb,
      new BlobTransactor(actorDb, blobstore, backgroundQueue),
    )

  return {
    sqlite,
    db,
    space: transactorFor(db),
    transact: (fn) => db.transaction((txn) => fn(transactorFor(txn))),
    queries,
    deletedFromBlobstore,
    plan: (q) =>
      sqlite
        .prepare(`EXPLAIN QUERY PLAN ${q.sql}`)
        .all(...(q.parameters as unknown[]))
        .map((row) => (row as { detail: string }).detail),
    close: () => db.close(),
  }
}

/** The last select whose main table is `table`. */
export function lastQueryOn(
  queries: CompiledQuery[],
  table: string,
): CompiledQuery {
  const found = queries.findLast(
    (q) => q.sql.startsWith('select') && q.sql.includes(`from "${table}"`),
  )
  if (!found) throw new Error(`No select from ${table} was run`)
  return found
}

/** How many times `text` occurs in the query's SQL. */
export function countOf(q: CompiledQuery, text: string): number {
  return q.sql.split(text).length - 1
}

/** Asserts the plan reads through `uses`, without a sort or a table scan. */
export function expectIndexed(lines: string[], uses: RegExp): void {
  expect(lines).toEqual(expect.arrayContaining([expect.stringMatching(uses)]))
  expect(lines.filter((line) => line.includes('USE TEMP B-TREE'))).toEqual([])
  expect(
    lines.filter((line) =>
      /^SCAN (space|space_record|space_record_oplog|space_record_blob)\b(?! USING)/.test(
        line,
      ),
    ),
  ).toEqual([])
}

/** Creates the records at `paths` in one commit, as ACTOR_DID. */
export async function putRecords(
  h: SpaceTestDb,
  ref: SpaceRef,
  paths: [string, string][],
): Promise<{ rev: string } | null> {
  const writes: PreparedCreate[] = await Promise.all(
    paths.map(async ([collection, rkey]) => {
      const record = { $type: collection, rkey }
      return {
        action: WriteOpAction.Create,
        uri: ref.recordUri(ACTOR_DID, collection as NsidString, rkey),
        cid: await cidForCbor(encode(record)),
        record,
        blobs: [],
      }
    }),
  )
  return h.transact((space) => space.applyWrites(ref, writes))
}

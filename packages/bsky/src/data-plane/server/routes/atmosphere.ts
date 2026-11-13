import { Timestamp } from '@bufbuild/protobuf'
import { Code, ConnectError, type ServiceImpl } from '@connectrpc/connect'
import { sql } from 'kysely'
import { parseCid } from '@atproto/lex-data'
import { isDidString } from '@atproto/lex-schema'
import { parseAtUriString } from '@atproto/syntax'
import { site, social } from '../../../lexicons/index.js'
import type { Service } from '../../../proto/bsky_connect.js'
import {
  RecordLookupResult,
  RecordLookupStatus,
  type RecordRef,
} from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { TimeCidKeyset } from '../db/pagination.js'
import { getRecords } from './records.js'

/** Generic record and backlink lookups for the local data plane. */
export function atmosphere(db: Database): Partial<ServiceImpl<typeof Service>> {
  const records = getRecords(db)

  async function lookup(refs: { uri: string; cid?: string }[]) {
    checkBatchSize(refs.length)
    const valid = refs.filter(validRef)
    const { records: found } = await records({ uris: valid.map((r) => r.uri) })
    const byUri = new Map(valid.map((ref, i) => [ref.uri, found[i]]))
    return {
      results: refs.map((ref) => {
        const record = byUri.get(ref.uri)
        const status = !validRef(ref)
          ? RecordLookupStatus.INVALID_REF
          : !record?.cid || (ref.cid !== undefined && ref.cid !== record.cid)
            ? RecordLookupStatus.NOT_FOUND
            : record.takenDown
              ? RecordLookupStatus.TAKEN_DOWN
              : RecordLookupStatus.FOUND
        return new RecordLookupResult({
          ref: { uri: ref.uri, cid: ref.cid ?? record?.cid ?? '' },
          record:
            status === RecordLookupStatus.FOUND ||
            status === RecordLookupStatus.TAKEN_DOWN
              ? record
              : undefined,
          status,
        })
      }),
    }
  }

  return {
    async getAtmosphereTimeline() {
      return { items: [] }
    },
    async getRecordsByRef({ refs }) {
      return lookup(refs)
    },
    async getRecordsByURI({ uris }) {
      return lookup(uris.map((uri) => ({ uri })))
    },
    async getAtmosphereBacklinkCounts({ targetUris, collection }) {
      checkBatchSize(targetUris.length)
      const rows = targetUris.length
        ? await backlinks(db, collection)
            .where(target, 'in', targetUris)
            .select([
              target.as('targetUri'),
              sourceCollection.as('collection'),
              (eb) => eb.fn.countAll<string>().as('count'),
            ])
            .groupBy(['targetUri', 'collection'])
            .execute()
        : []
      return {
        results: targetUris.map((targetUri) => ({
          targetUri,
          counts: Object.fromEntries(
            rows
              .filter((row) => row.targetUri === targetUri)
              .map((row) => [row.collection, BigInt(row.count)]),
          ),
        })),
      }
    },
    async getAtmosphereBacklinks({ targetUri, collection, limit, cursor }) {
      const size = Math.max(1, Math.min(limit || 50, 100))
      const keyset = new BacklinkKeyset(
        sql.ref('record.indexedAt'),
        sql.ref('record.uri'),
      )
      const query = backlinks(db, collection)
        .where(target, '=', targetUri)
        .select(['record.uri', 'record.indexedAt'])
      const page = keyset.page(
        await keyset.paginate(query, { limit: size, cursor }).execute(),
        size,
      )
      return {
        backlinks: page.items.map((row) => ({
          uri: row.uri,
          sortedAt: Timestamp.fromDate(new Date(row.indexedAt)),
        })),
        cursor: page.cursor,
      }
    },
    async getAtmosphereBacklinksByActor({ targetUris, actorDid, collection }) {
      checkBatchSize(targetUris.length)
      const cap = 1000
      const rows = targetUris.length
        ? await backlinks(db, collection)
            .where('record.did', '=', actorDid)
            .where(target, 'in', targetUris)
            .select(['record.uri', target.as('targetUri')])
            .orderBy('record.uri')
            .limit(cap + 1)
            .execute()
        : []
      return {
        results: targetUris.map((targetUri) => ({
          targetUri,
          uris: rows
            .slice(0, cap)
            .filter((row) => row.targetUri === targetUri)
            .map((row) => row.uri),
        })),
        truncated: rows.length > cap,
      }
    },
  }
}

const backlinkPaths: ReadonlyMap<string, string> = new Map([
  [site.standard.graph.recommend.$type, 'document'],
  [site.standard.graph.subscription.$type, 'publication'],
  [social.grain.gallery.item.$type, 'gallery'],
  [social.grain.favorite.$type, 'subject'],
])
const sourceCollection = sql<string>`split_part(record.uri, '/', 4)`
// @NOTE Read links from stored records so updates, deletions and takedowns
// immediately affect local backlinks without a separate index or migration.
const target = sql<string>`case ${sourceCollection}
  ${sql.join(
    [...backlinkPaths].map(
      ([collection, path]) =>
        sql`when ${collection} then record.json::jsonb ->> ${path}`,
    ),
    sql` `,
  )}
end`

function backlinks(db: Database, collection: string) {
  return db.db
    .selectFrom('record')
    .innerJoin('actor', 'actor.did', 'record.did')
    .where(
      sourceCollection,
      'in',
      collection ? [collection] : [...backlinkPaths.keys()],
    )
    .where('record.takedownRef', 'is', null)
    .where('actor.takedownRef', 'is', null)
    .where('actor.upstreamStatus', 'is', null)
}

function validRef(ref: Pick<RecordRef, 'uri'> & { cid?: string }): boolean {
  const parsed = parseAtUriString(ref.uri)
  if (
    !parsed.success ||
    !isDidString(parsed.value.authority) ||
    !parsed.value.collection ||
    !parsed.value.rkey ||
    parsed.value.query !== undefined ||
    parsed.value.hash !== undefined
  ) {
    return false
  }
  if (ref.cid !== undefined) {
    try {
      parseCid(ref.cid)
    } catch {
      return false
    }
  }
  return true
}

function checkBatchSize(length: number): void {
  if (length > 100) {
    throw new ConnectError(
      'At most 100 records per request',
      Code.InvalidArgument,
    )
  }
}

class BacklinkKeyset extends TimeCidKeyset<{ uri: string; indexedAt: string }> {
  labelResult(row: { uri: string; indexedAt: string }) {
    return { primary: row.indexedAt, secondary: row.uri }
  }
}

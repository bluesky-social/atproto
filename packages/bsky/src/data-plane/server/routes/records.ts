import { Timestamp } from '@bufbuild/protobuf'
import type { ServiceImpl } from '@connectrpc/connect'
import * as ui8 from 'uint8arrays'
import { keyBy } from '@atproto/common'
import { l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { app, chat, com } from '../../../lexicons/index.js'
import { dataplaneLogger } from '../../../logger.js'
import type { Service } from '../../../proto/bsky_connect.js'
import { PostRecordMeta, Record } from '../../../proto/bsky_pb.js'
import type { Database } from '../db/index.js'
import { resolveCanonicalOpThread } from '../op-thread.js'

export default (db: Database): Partial<ServiceImpl<typeof Service>> => ({
  getBlockRecords: getRecords(db, app.bsky.graph.block),
  getFeedGeneratorRecords: getRecords(db, app.bsky.feed.generator),
  getFollowRecords: getRecords(db, app.bsky.graph.follow),
  getLikeRecords: getRecords(db, app.bsky.feed.like),
  getListBlockRecords: getRecords(db, app.bsky.graph.listblock),
  getListItemRecords: getRecords(db, app.bsky.graph.listitem),
  getListRecords: getRecords(db, app.bsky.graph.list),
  getPostRecords: getPostRecords(db),
  getProfileRecords: getRecords(db, app.bsky.actor.profile),
  getRepostRecords: getRecords(db, app.bsky.feed.repost),
  getThreadGateRecords: getRecords(db, app.bsky.feed.threadgate),
  getPostgateRecords: getRecords(db, app.bsky.feed.postgate),
  getLabelerRecords: getRecords(db, app.bsky.labeler.service),
  getActorChatDeclarationRecords: getRecords(db, chat.bsky.actor.declaration),
  getNotificationDeclarationRecords: getRecords(
    db,
    app.bsky.notification.declaration,
  ),
  getGermDeclarationRecords: getRecords(db, com.germnetwork.declaration),
  getStarterPackRecords: getRecords(db, app.bsky.graph.starterpack),
  getVerificationRecords: getRecords(db, app.bsky.graph.verification),
  getStatusRecords: getRecords(db, app.bsky.actor.status),
})

export const getRecords = (db: Database, ns?: l.Main<l.RecordSchema>) => {
  const collection = ns ? l.getMain(ns).$type : undefined

  return async (req: { uris: string[] }): Promise<{ records: Record[] }> => {
    const validUris = collection
      ? req.uris.filter((uri) => new AtUri(uri).collection === collection)
      : req.uris
    const res = validUris.length
      ? await db.db
          .selectFrom('record')
          .selectAll()
          .where('uri', 'in', validUris)
          .execute()
      : []
    const byUri = keyBy(res, 'uri')
    const records: Record[] = req.uris.map((uri) => {
      const row = byUri.get(uri)
      const json = row ? row.json : JSON.stringify(null)
      const createdAtRaw = new Date(JSON.parse(json)?.['createdAt'])
      const createdAt = !isNaN(createdAtRaw.getTime())
        ? Timestamp.fromDate(createdAtRaw)
        : undefined
      const indexedAt = row?.indexedAt
        ? Timestamp.fromDate(new Date(row?.indexedAt))
        : undefined
      const recordBytes = ui8.fromString(json, 'utf8')
      return new Record({
        record: recordBytes as Uint8Array<ArrayBuffer>,
        cid: row?.cid,
        createdAt,
        indexedAt,
        sortedAt: compositeTime(createdAt, indexedAt),
        takenDown: !!row?.takedownRef,
        takedownRef: row?.takedownRef ?? undefined,
        tags: row?.tags ?? undefined,
      })
    })
    return { records }
  }
}

export const getPostRecords = (db: Database) => {
  const getBaseRecords = getRecords(db, app.bsky.feed.post)
  return async (req: {
    uris: string[]
    includeOpThreadMetadata?: boolean
  }): Promise<{ records: Record[]; meta: PostRecordMeta[] }> => {
    const [{ records }, details, opThreadMetadata] = await Promise.all([
      getBaseRecords(req),
      req.uris.length
        ? db.db
            .selectFrom('post')
            .where('uri', 'in', req.uris)
            .select([
              'uri',
              'violatesThreadGate',
              'violatesEmbeddingRules',
              'hasThreadGate',
              'hasPostGate',
            ])
            .execute()
        : [],
      req.includeOpThreadMetadata
        ? getOpThreadMetadata(db, req.uris)
        : new Map<string, OpThreadMetadata>(),
    ])
    const byKey = keyBy(details, 'uri')
    const meta = req.uris.map((uri) => {
      const thread = opThreadMetadata.get(uri)
      return new PostRecordMeta({
        violatesThreadGate: !!byKey.get(uri)?.violatesThreadGate,
        violatesEmbeddingRules: !!byKey.get(uri)?.violatesEmbeddingRules,
        hasThreadGate: !!byKey.get(uri)?.hasThreadGate,
        hasPostGate: !!byKey.get(uri)?.hasPostGate,
        opThreadPostIndex: thread?.index,
        opThreadPostCount: thread?.count,
      })
    })
    return { records, meta }
  }
}

type OpThreadMetadata = {
  index: number
  count: number
}

// Ceiling on OP replies fetched per thread root. op_thread_reply holds every
// reply the OP wrote anywhere in their own thread, so a high-engagement thread
// whose OP answers many commenters can carry far more rows than the canonical
// chain ever uses. Resolving those on the hydration path is unbounded work, so
// a root over this ceiling yields no metadata at all rather than metadata
// derived from a truncated — and therefore wrong — set of replies.
export const OP_THREAD_REPLY_LIMIT = 1000

const getOpThreadMetadata = async (
  db: Database,
  uris: string[],
): Promise<Map<string, OpThreadMetadata>> => {
  if (!uris.length) return new Map()

  const requestedRoots = db.db
    .selectFrom('post')
    .where('uri', 'in', uris)
    .select((eb) => eb.fn.coalesce('replyRoot', 'uri').as('rootUri'))
    .distinct()

  const ranked = db.db
    .selectFrom('op_thread_reply')
    .innerJoin(
      requestedRoots.as('requested_root'),
      'requested_root.rootUri',
      'op_thread_reply.rootUri',
    )
    .select((eb) => [
      'op_thread_reply.rootUri',
      'op_thread_reply.uri',
      'op_thread_reply.parentUri',
      'op_thread_reply.deletedAt',
      eb.fn
        .agg<number>('row_number')
        .over((ob) =>
          ob
            .partitionBy('op_thread_reply.rootUri')
            .orderBy('op_thread_reply.uri'),
        )
        .as('rank'),
    ])

  // Fetch one row past the ceiling so an over-limit root is distinguishable
  // from one that lands exactly on it.
  const rows = await db.db
    .selectFrom(ranked.as('ranked'))
    .selectAll()
    .where('rank', '<=', OP_THREAD_REPLY_LIMIT + 1)
    .execute()

  const repliesByRoot = new Map<
    string,
    { uri: string; parentUri: string; deletedAt: string | null }[]
  >()
  for (const row of rows) {
    const replies = repliesByRoot.get(row.rootUri) ?? []
    replies.push(row)
    repliesByRoot.set(row.rootUri, replies)
  }

  const metadata = new Map<string, OpThreadMetadata>()
  const skippedRoots: string[] = []
  for (const [rootUri, replies] of repliesByRoot) {
    if (replies.length > OP_THREAD_REPLY_LIMIT) {
      skippedRoots.push(rootUri)
      continue
    }

    const opThread = resolveCanonicalOpThread(rootUri, replies)
    if (!opThread) continue

    const count = opThread.length
    for (let i = 0; i < count; i++) {
      metadata.set(opThread[i], { index: i + 1, count })
    }
  }

  // Volume stats stay at debug so the hydration path pays nothing by default;
  // raise the bsky:dp level to size batches during rollout. Hitting the
  // ceiling is rare and actionable, so that warns.
  const stats = {
    uris: uris.length,
    roots: repliesByRoot.size,
    rows: rows.length,
  }
  if (skippedRoots.length) {
    dataplaneLogger.warn(
      { ...stats, skippedRoots },
      'op thread reply ceiling hit, metadata omitted for these roots',
    )
  } else {
    dataplaneLogger.debug(stats, 'op thread metadata resolved')
  }

  return metadata
}

const compositeTime = (
  ts1: Timestamp | undefined,
  ts2: Timestamp | undefined,
) => {
  if (!ts1) return ts2
  if (!ts2) return ts1
  return ts1.toDate() < ts2.toDate() ? ts1 : ts2
}

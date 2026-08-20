import { Timestamp } from '@bufbuild/protobuf'
import type { ServiceImpl } from '@connectrpc/connect'
import * as ui8 from 'uint8arrays'
import { keyBy } from '@atproto/common'
import { l } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import { app, chat, com } from '../../../lexicons/index.js'
import { dataplaneLogger } from '../../../logger.js'
import type { Service } from '../../../proto/bsky_connect.js'
import { OpThread, PostRecordMeta, Record } from '../../../proto/bsky_pb.js'
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
  }): Promise<{
    records: Record[]
    meta: PostRecordMeta[]
    opThreads: OpThread[]
  }> => {
    const [{ records }, details, opThreads] = await Promise.all([
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
      req.includeOpThreadMetadata ? getOpThreads(db, req.uris) : [],
    ])
    const byKey = keyBy(details, 'uri')
    const meta = req.uris.map((uri) => {
      return new PostRecordMeta({
        violatesThreadGate: !!byKey.get(uri)?.violatesThreadGate,
        violatesEmbeddingRules: !!byKey.get(uri)?.violatesEmbeddingRules,
        hasThreadGate: !!byKey.get(uri)?.hasThreadGate,
        hasPostGate: !!byKey.get(uri)?.hasPostGate,
      })
    })
    return { records, meta, opThreads }
  }
}

const getOpThreads = async (
  db: Database,
  uris: string[],
): Promise<OpThread[]> => {
  if (!uris.length) return []

  const requestedRoots = db.db
    .selectFrom('post')
    .where('uri', 'in', uris)
    .select((eb) => eb.fn.coalesce('replyRoot', 'uri').as('rootUri'))
    .distinct()

  const rows = await db.db
    .selectFrom('op_thread_reply')
    .innerJoin(
      requestedRoots.as('requested_root'),
      'requested_root.rootUri',
      'op_thread_reply.rootUri',
    )
    .select([
      'op_thread_reply.rootUri',
      'op_thread_reply.uri',
      'op_thread_reply.parentUri',
      'op_thread_reply.deletedAt',
    ])
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

  const opThreads: OpThread[] = []
  for (const [rootUri, replies] of repliesByRoot) {
    const opThread = resolveCanonicalOpThread(rootUri, replies)
    if (!opThread) continue

    opThreads.push(new OpThread({ rootUri, uris: opThread }))
  }

  dataplaneLogger.debug(
    { uris: uris.length, roots: repliesByRoot.size, rows: rows.length },
    'op threads resolved',
  )

  return opThreads
}

const compositeTime = (
  ts1: Timestamp | undefined,
  ts2: Timestamp | undefined,
) => {
  if (!ts1) return ts2
  if (!ts2) return ts1
  return ts1.toDate() < ts2.toDate() ? ts1 : ts2
}

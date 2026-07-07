import assert from 'node:assert'
import { lexParse } from '@atproto/lex'
import { AtUri } from '@atproto/syntax'
import {
  type BsyncClient,
  authWithApiKey,
  createBsyncClient,
} from '../../bsync.js'
import type { ServerConfig } from '../../config.js'
import { app } from '../../lexicons/index.js'
import { subLogger as log } from '../../logger.js'
import {
  Method,
  type MuteOperation,
  MuteOperation_Type,
  type NotifOperation,
  type Operation,
} from '../../proto/bsync_pb.js'
import { Namespaces } from '../../stash.js'
import type { Database } from './db/index.js'
import { countAll, excluded } from './db/util.js'

export type BsyncCursors = {
  op?: string
  mute?: string
  notif?: string
}

export class BsyncSubscription {
  private ac: AbortController | undefined
  private pendingScans = new Set<Promise<void>>()
  private bsyncClient: BsyncClient
  private db: Database
  // Latest cursor processed for each stream, used to wait until caught up.
  private cursors: BsyncCursors = {}

  constructor(public opts: { db: Database; config: ServerConfig }) {
    const { config, db } = opts

    this.db = db
    this.bsyncClient = createBsyncClient({
      baseUrl: config.bsyncUrl,
      httpVersion: config.bsyncHttpVersion ?? '2',
      nodeOptions: { rejectUnauthorized: !config.bsyncIgnoreBadTls },
      interceptors: config.bsyncApiKey
        ? [authWithApiKey(config.bsyncApiKey)]
        : [],
    })
  }

  get running() {
    return !!this.ac
  }

  start() {
    if (this.ac) return
    this.ac = new AbortController()
    this.scanMuteOperations()
    this.scanNotifOperations()
    this.scanOperations()
  }

  /**
   * Waits until the subscription has processed every operation that existed in
   * bsync at the time `targets` was read (one cursor per stream). Returns as
   * soon as the cursors catch up - it does not wait for the bsync long-poll
   * timeout. Intended for tests/dev.
   */
  async processAll(targets: BsyncCursors, timeout = 5000) {
    if (!this.ac) return
    const start = Date.now()
    while (!this.isCaughtUp(targets)) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `bsync subscription was not caught up within ${timeout}ms`,
        )
      }
      await wait(5)
    }
  }

  private isCaughtUp(targets: BsyncCursors) {
    return (
      gteCursor(this.cursors.op, targets.op) &&
      gteCursor(this.cursors.mute, targets.mute) &&
      gteCursor(this.cursors.notif, targets.notif)
    )
  }

  async destroy() {
    // Aborting cancels any in-flight long-poll scan immediately, so we don't
    // have to wait for the bsync long-poll timeout to elapse.
    this.ac?.abort()
    this.ac = undefined
    // Wait for the ongoing scans to unwind cleanly.
    await Promise.all(this.pendingScans)
  }

  /**
   * starts a scanner in the background, killing it when this instance is
   * destroyed, and storing its promise in `this.pendingScans` to allow
   * awaiting.
   */
  private startScanning(
    scanner: (
      cursor: undefined | string,
      signal: AbortSignal,
    ) => Promise<string | undefined>,
  ) {
    if (!this.ac) return
    const signal = this.ac.signal

    const scanPromise = this.runScanner(scanner, signal)

    this.pendingScans.add(scanPromise)
    void scanPromise
      .catch(() => {})
      .finally(() => {
        this.pendingScans.delete(scanPromise)
      })
  }

  private async runScanner(
    scanner: (
      cursor: undefined | string,
      signal: AbortSignal,
    ) => Promise<string | undefined>,
    signal: AbortSignal,
  ) {
    let cursor: undefined | string

    while (!signal.aborted) {
      try {
        cursor = await scanner(cursor, signal)
      } catch (err) {
        if (signal.aborted) break

        log.error({ err }, 'error in bsync scan')

        // retry in a bit, but bail out early if we're shutting down
        await wait(100, signal)
      }
    }
  }

  private scanMuteOperations() {
    this.startScanning(async (cursor, signal) => {
      const res = await this.bsyncClient.scanMuteOperations(
        { cursor },
        { signal },
      )

      await this.processMuteOperations(res.operations)
      this.cursors.mute = res.cursor

      return res.cursor
    })
  }

  private async processMuteOperations(operations: MuteOperation[]) {
    for (const op of operations) {
      const { type, actorDid, subject } = op
      if (type === MuteOperation_Type.ADD) {
        if (subject.startsWith('did:')) {
          await this.db.db
            .insertInto('mute')
            .values({
              mutedByDid: actorDid,
              subjectDid: subject,
              createdAt: new Date().toISOString(),
            })
            .onConflict((oc) => oc.doNothing())
            .execute()
        } else {
          const uri = new AtUri(subject)
          if (uri.collection === app.bsky.graph.list.$type) {
            await this.db.db
              .insertInto('list_mute')
              .values({
                mutedByDid: actorDid,
                listUri: subject,
                createdAt: new Date().toISOString(),
              })
              .onConflict((oc) => oc.doNothing())
              .execute()
          } else {
            await this.db.db
              .insertInto('thread_mute')
              .values({
                mutedByDid: actorDid,
                rootUri: subject,
                createdAt: new Date().toISOString(),
              })
              .onConflict((oc) => oc.doNothing())
              .execute()
          }
        }
      } else if (type === MuteOperation_Type.REMOVE) {
        if (subject.startsWith('did:')) {
          await this.db.db
            .deleteFrom('mute')
            .where('mutedByDid', '=', actorDid)
            .where('subjectDid', '=', subject)
            .execute()
        } else {
          const uri = new AtUri(subject)
          if (uri.collection === app.bsky.graph.list.$type) {
            await this.db.db
              .deleteFrom('list_mute')
              .where('mutedByDid', '=', actorDid)
              .where('listUri', '=', subject)
              .execute()
          } else {
            await this.db.db
              .deleteFrom('thread_mute')
              .where('mutedByDid', '=', actorDid)
              .where('rootUri', '=', subject)
              .execute()
          }
        }
      } else if (type === MuteOperation_Type.CLEAR) {
        await this.db.db
          .deleteFrom('mute')
          .where('mutedByDid', '=', actorDid)
          .execute()
        await this.db.db
          .deleteFrom('list_mute')
          .where('mutedByDid', '=', actorDid)
          .execute()
      }
    }
  }

  private scanNotifOperations() {
    this.startScanning(async (cursor, signal) => {
      const res = await this.bsyncClient.scanNotifOperations(
        { cursor },
        { signal },
      )

      await this.processNotifOperations(res.operations)
      this.cursors.notif = res.cursor

      return res.cursor
    })
  }

  private async processNotifOperations(operations: NotifOperation[]) {
    for (const op of operations) {
      const { actorDid, priority } = op
      if (priority !== undefined) {
        await this.db.db
          .insertInto('actor_state')
          .values({
            did: actorDid,
            priorityNotifs: priority,
            lastSeenNotifs: new Date().toISOString(),
          })
          .onConflict((oc) =>
            oc.column('did').doUpdateSet({ priorityNotifs: priority }),
          )
          .execute()
      }
    }
  }

  private scanOperations() {
    this.startScanning(async (cursor, signal) => {
      const res = await this.bsyncClient.scanOperations({ cursor }, { signal })

      await this.processOperations(res.operations)
      this.cursors.op = res.cursor

      return res.cursor
    })
  }

  private async processOperations(operations: Operation[]) {
    for (const op of operations) {
      const { namespace } = op

      const now = new Date().toISOString()

      // Index all items into private_data.
      await handleGenericOperation(this.db, op, now)

      // Maintain bespoke indexes for certain namespaces. A failure here must
      // not stall the stream, so log and move on (matching bsync behavior).
      try {
        if (
          namespace ===
          Namespaces.AppBskyNotificationDefsSubjectActivitySubscription.$type
        ) {
          await handleSubjectActivitySubscriptionOperation(this.db, op, now)
        } else if (
          namespace === Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent.$type
        ) {
          await handleAgeAssuranceEventOperation(this.db, op, now)
        } else if (
          namespace === Namespaces.AppBskyAgeassuranceDefsEvent.$type
        ) {
          await handleAgeAssuranceV2EventOperation(this.db, op, now)
        } else if (namespace === Namespaces.AppBskyBookmarkDefsBookmark.$type) {
          await handleBookmarkOperation(this.db, op, now)
        } else if (namespace === Namespaces.AppBskyDraftDefsDraftWithId.$type) {
          await handleDraftOperation(this.db, op, now)
        }
      } catch (err) {
        log.warn({ err, namespace }, 'bsync put operation indexing failed')
      }
    }
  }
}

type HandleOperation = (
  db: Database,
  op: Operation,
  now: string,
) => Promise<void>

// upsert into or remove from private_data
const handleGenericOperation: HandleOperation = async (
  db: Database,
  op: Operation,
  now: string,
) => {
  const { actorDid, namespace, key, method, payload } = op
  if (method === Method.CREATE || method === Method.UPDATE) {
    await db.db
      .insertInto('private_data')
      .values({
        actorDid,
        namespace,
        key,
        payload: Buffer.from(payload).toString('utf8'),
        indexedAt: now,
        updatedAt: now,
      })
      .onConflict((oc) =>
        oc.columns(['actorDid', 'namespace', 'key']).doUpdateSet({
          payload: excluded(db.db, 'payload'),
          updatedAt: excluded(db.db, 'updatedAt'),
        }),
      )
      .execute()
  } else if (method === Method.DELETE) {
    await db.db
      .deleteFrom('private_data')
      .where('actorDid', '=', actorDid)
      .where('namespace', '=', namespace)
      .where('key', '=', key)
      .execute()
  } else {
    assert.fail(`unexpected method ${method}`)
  }
}

const handleSubjectActivitySubscriptionOperation: HandleOperation = async (
  db: Database,
  op: Operation,
  now: string,
) => {
  const { actorDid, key, method, payload } = op

  if (method === Method.DELETE) {
    await db.db
      .deleteFrom('activity_subscription')
      .where('creator', '=', actorDid)
      .where('key', '=', key)
      .execute()
    return
  }

  const parsed =
    lexParse<app.bsky.notification.defs.SubjectActivitySubscription>(
      Buffer.from(payload).toString('utf8'),
    )
  const {
    subject,
    activitySubscription: { post, reply },
  } = parsed

  if (method === Method.CREATE) {
    await db.db
      .insertInto('activity_subscription')
      .values({
        creator: actorDid,
        subjectDid: subject,
        key,
        indexedAt: now,
        post,
        reply,
      })
      .execute()
    return
  }

  await db.db
    .updateTable('activity_subscription')
    .where('creator', '=', actorDid)
    .where('key', '=', key)
    .set({
      indexedAt: now,
      post,
      reply,
    })
    .execute()
}

const handleAgeAssuranceEventOperation: HandleOperation = async (
  db: Database,
  op: Operation,
) => {
  const { actorDid, method, payload } = op
  if (method !== Method.CREATE) return

  const parsed = lexParse<app.bsky.unspecced.defs.AgeAssuranceEvent>(
    Buffer.from(payload).toString('utf8'),
  )
  const { status, createdAt } = parsed

  const update = {
    ageAssuranceStatus: status,
    ageAssuranceLastInitiatedAt: status === 'pending' ? createdAt : undefined,
  }

  await db.db
    .updateTable('actor')
    .set(update)
    .where('did', '=', actorDid)
    .execute()
}

const handleAgeAssuranceV2EventOperation: HandleOperation = async (
  db: Database,
  op: Operation,
) => {
  const { actorDid, method, payload } = op
  if (method !== Method.CREATE) return

  const parsed = lexParse<app.bsky.ageassurance.defs.Event>(
    Buffer.from(payload).toString('utf8'),
  )
  const { status, createdAt, access, countryCode, regionCode } = parsed

  const update = {
    ageAssuranceStatus: status,
    ageAssuranceLastInitiatedAt: status === 'pending' ? createdAt : undefined,
    ageAssuranceAccess: access,
    ageAssuranceCountryCode: countryCode,
    ageAssuranceRegionCode: regionCode,
  }

  await db.db
    .updateTable('actor')
    .set(update)
    .where('did', '=', actorDid)
    .execute()
}

const handleBookmarkOperation: HandleOperation = async (
  db: Database,
  op: Operation,
  now: string,
) => {
  const { actorDid, key, method, payload } = op

  const updateAgg = (uri: string, dbTxn: Database) => {
    return dbTxn.db
      .insertInto('post_agg')
      .values({
        uri,
        bookmarkCount: dbTxn.db
          .selectFrom('bookmark')
          .where('bookmark.subjectUri', '=', uri)
          .select(countAll.as('count')),
      })
      .onConflict((oc) =>
        oc
          .column('uri')
          .doUpdateSet({ bookmarkCount: excluded(dbTxn.db, 'bookmarkCount') }),
      )
      .execute()
  }

  if (method === Method.CREATE) {
    const parsed = lexParse<app.bsky.bookmark.defs.Bookmark>(
      Buffer.from(payload).toString('utf8'),
    )
    const {
      subject: { uri, cid },
    } = parsed

    await db.transaction(async (dbTxn) => {
      await dbTxn.db
        .insertInto('bookmark')
        .values({
          creator: actorDid,
          key,
          indexedAt: now,
          subjectUri: uri,
          subjectCid: cid,
        })
        .execute()

      await updateAgg(uri, dbTxn)
    })
  }

  if (method === Method.DELETE) {
    await db.transaction(async (dbTxn) => {
      const bookmark = await dbTxn.db
        .selectFrom('bookmark')
        .selectAll()
        .where('creator', '=', actorDid)
        .where('key', '=', key)
        .executeTakeFirst()

      if (bookmark) {
        await dbTxn.db
          .deleteFrom('bookmark')
          .where('creator', '=', actorDid)
          .where('key', '=', key)
          .execute()

        await updateAgg(bookmark.subjectUri, dbTxn)
      }
    })
  }
}

const handleDraftOperation: HandleOperation = async (
  db: Database,
  op: Operation,
  now: string,
) => {
  const { actorDid, key, method, payload } = op

  if (method === Method.CREATE) {
    const payloadString = Buffer.from(payload).toString('utf8')

    await db.db
      .insertInto('draft')
      .values({
        creator: actorDid,
        key,
        createdAt: now,
        updatedAt: now,
        payload: payloadString,
      })
      .execute()
  }

  if (method === Method.UPDATE) {
    const payloadString = Buffer.from(payload).toString('utf8')

    await db.db
      .updateTable('draft')
      .where('creator', '=', actorDid)
      .where('key', '=', key)
      .set({
        updatedAt: now,
        payload: payloadString,
      })
      .execute()
  }

  if (method === Method.DELETE) {
    await db.db
      .deleteFrom('draft')
      .where('creator', '=', actorDid)
      .where('key', '=', key)
      .execute()
  }
}

// compares numeric (bigint) cursor ids; an undefined target is always satisfied
const gteCursor = (current: string | undefined, target: string | undefined) => {
  if (!target) return true
  return BigInt(current || '0') >= BigInt(target)
}

// resolves after `ms`, or early if `signal` aborts
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve()
    const done = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', done)
      resolve()
    }
    const timer = setTimeout(done, ms)
    signal?.addEventListener('abort', done, { once: true })
  })

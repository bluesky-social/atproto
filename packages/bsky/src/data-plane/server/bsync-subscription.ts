import assert from 'node:assert'
import { EventEmitter, once } from 'node:events'
import { jsonStringToLex } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { BsyncClient, authWithApiKey, createBsyncClient } from '../../bsync'
import { ServerConfig } from '../../config'
import { ids } from '../../lexicon/lexicons'
import { SubjectActivitySubscription } from '../../lexicon/types/app/bsky/notification/defs'
import { AgeAssuranceEvent } from '../../lexicon/types/app/bsky/unspecced/defs'
import { subLogger as log } from '../../logger'
import {
  Method,
  MuteOperation,
  MuteOperation_Type,
  NotifOperation,
  Operation,
} from '../../proto/bsync_pb'
import { Namespaces } from '../../stash'
import { Database } from './db'
import { excluded } from './db/util'

export class BsyncSubscription extends EventEmitter {
  private ac: AbortController | undefined
  private pendingScans = new Set<Promise<void>>()
  private bsyncClient: BsyncClient
  private db: Database

  constructor(public opts: { db: Database; config: ServerConfig }) {
    super()
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

  start() {
    if (this.ac) return
    this.ac = new AbortController()
    this.scanMuteOperations()
    this.scanNotifOperations()
    this.scanOperations()
  }

  async processAll() {
    // console.log('### bsync subscription processAll 0')
    if (!this.ac) return
    await Promise.all(this.pendingScans)

    // console.log('### bsync subscription processAll 1')
    // const signal = this.ac.signal
    // try {
    //   await Promise.all([
    //     once(this, 'mute:idle', { signal }),
    //     once(this, 'notif:idle', { signal }),
    //     once(this, 'op:idle', { signal }),
    //   ])
    // } catch {
    //   // stopped while waiting for idle
    // }
    // console.log('### bsync subscription processAll 2')
  }

  async destroy() {
    this.ac?.abort()
    this.ac = undefined
    // Don't wait for the scans to become idle, just for the ongoing ones to finish.
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

        // retry in a bit
        await new Promise((r) => setTimeout(r, 100))
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

      const didWork = res.operations.length > 0
      if (!didWork) {
        console.log('### bsync subscription emit mute:idle')
        this.emit('mute:idle')
      }

      return res.cursor
    })
  }

  private async processMuteOperations(operations: MuteOperation[]) {
    for await (const op of operations) {
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
          if (uri.collection === ids.AppBskyGraphList) {
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
          if (uri.collection === ids.AppBskyGraphList) {
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
      const didWork = res.operations.length > 0
      if (!didWork) {
        console.log('### bsync subscription emit notif:idle')
        this.emit('notif:idle')
      }

      return res.cursor
    })
  }

  private async processNotifOperations(operations: NotifOperation[]) {
    for await (const op of operations) {
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
      const didWork = res.operations.length > 0
      if (!didWork) {
        console.log('### bsync subscription emit op:idle')
        this.emit('op:idle')
      }

      return res.cursor
    })
  }

  private async processOperations(operations: Operation[]) {
    for await (const op of operations) {
      const { namespace } = op

      const now = new Date().toISOString()

      // Index all items into private_data.
      await handleGenericOperation(this.db, op, now)

      // Maintain bespoke indexes for certain namespaces.
      if (
        namespace ===
        Namespaces.AppBskyNotificationDefsSubjectActivitySubscription
      ) {
        await handleSubjectActivitySubscriptionOperation(this.db, op, now)
      } else if (
        namespace === Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent
      ) {
        await handleAgeAssuranceEventOperation(this.db, op, now)
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
  }

  const parsed = jsonStringToLex(
    Buffer.from(payload).toString('utf8'),
  ) as SubjectActivitySubscription
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

  const parsed = jsonStringToLex(
    Buffer.from(payload).toString('utf8'),
  ) as AgeAssuranceEvent
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

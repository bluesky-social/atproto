import assert from 'node:assert'
import { jsonStringToLex } from '@atproto/lexicon'
import { AtUri } from '@atproto/syntax'
import { BsyncClient, authWithApiKey, createBsyncClient } from '../../bsync'
import { ServerConfig } from '../../config'
import { ids } from '../../lexicon/lexicons'
import { SubjectActivitySubscription } from '../../lexicon/types/app/bsky/notification/defs'
import { AgeAssuranceEvent } from '../../lexicon/types/app/bsky/unspecced/defs'
import { subLogger as log } from '../../logger'
import { Method, MuteOperation_Type, Operation } from '../../proto/bsync_pb'
import { Namespaces } from '../../stash'
import { BackgroundQueue } from './background'
import { Database } from './db'
import { excluded } from './db/util'

export class BsyncSubscription {
  private ac: AbortController | undefined
  private background: BackgroundQueue
  private bsyncClient: BsyncClient
  private db: Database

  constructor(public opts: { db: Database; config: ServerConfig }) {
    const { config, db } = opts
    this.background = new BackgroundQueue(db)

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
    await this.background.processAll()
  }

  async destroy() {
    if (this.ac?.signal.aborted) return
    this.ac?.abort()
    await this.processAll()
  }

  private startScanning(
    callFn: (cursor?: string) => Promise<string | undefined>,
    cursor?: string,
  ) {
    if (this.ac?.signal.aborted) return

    callFn(cursor)
      .then((nextCursor) => {
        this.startScanning(callFn, nextCursor)
      })
      .catch((err) => {
        if (this.ac?.signal.aborted) return
        log.error({ err }, 'error in bsync scan')
      })
  }

  private scanMuteOperations() {
    this.startScanning((cursor?: string) => {
      return this.bsyncClient
        .scanMuteOperations({ cursor }, { signal: this.ac?.signal })
        .then(async (res) => {
          if (this.ac?.signal.aborted) return
          this.background.add(async () => {
            for await (const op of res.operations) {
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
          })

          return res.cursor
        })
    })
  }

  private scanNotifOperations() {
    this.startScanning((cursor?: string) => {
      return this.bsyncClient
        .scanNotifOperations({ cursor }, { signal: this.ac?.signal })
        .then(async (res) => {
          if (this.ac?.signal.aborted) return
          this.background.add(async () => {
            for await (const op of res.operations) {
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
          })

          return res.cursor
        })
    })
  }

  private scanOperations() {
    this.startScanning((cursor?: string) => {
      return this.bsyncClient
        .scanOperations({ cursor }, { signal: this.ac?.signal })
        .then(async (res) => {
          if (this.ac?.signal.aborted) return
          this.background.add(async () => {
            for await (const op of res.operations) {
              const { namespace } = op

              const now = new Date().toISOString()

              // Index all items into private_data.
              await handleGenericOperation(this.db, op, now)

              // Maintain bespoke indexes for certain namespaces.
              if (
                namespace ===
                Namespaces.AppBskyNotificationDefsSubjectActivitySubscription
              ) {
                await handleSubjectActivitySubscriptionOperation(
                  this.db,
                  op,
                  now,
                )
              } else if (
                namespace === Namespaces.AppBskyUnspeccedDefsAgeAssuranceEvent
              ) {
                await handleAgeAssuranceEventOperation(this.db, op, now)
              }
            }
          })

          return res.cursor
        })
    })
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

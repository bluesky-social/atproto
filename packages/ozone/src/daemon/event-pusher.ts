import type { Insertable, Selectable } from 'kysely'
import PQueue from 'p-queue'
import { SECOND, retry } from '@atproto/common'
import {
  Client,
  type DidString,
  XrpcFetchError,
  XrpcInternalError,
  XrpcResponseError,
} from '@atproto/lex'
import type { Database } from '../db/index.js'
import type { BlobPushEvent } from '../db/schema/blob_push_event.js'
import type { RepoPushEventType } from '../db/schema/repo_push_event.js'
import { com } from '../lexicons/index.js'
import { dbLogger } from '../logger.js'

type EventSubject = com.atproto.admin.updateSubjectStatus.$InputBody['subject']

type PollState = {
  timer?: NodeJS.Timeout
  promise: Promise<void>
}

type AuthHeaders = {
  headers: {
    authorization: string
  }
}

type Service = {
  client: Client
  did: DidString
  rateLimitedUntil?: number
}

type PushResult = 'confirmed' | 'failed' | 'deferred'

const PUSH_CONCURRENCY = 10
const RETRY_INTERVAL = 30 * SECOND

export class EventPusher {
  destroyed = false
  private pushQueue: PQueue = new PQueue({ concurrency: PUSH_CONCURRENCY })

  repoPollState: PollState = {
    promise: Promise.resolve(),
  }
  recordPollState: PollState = {
    promise: Promise.resolve(),
  }
  blobPollState: PollState = {
    promise: Promise.resolve(),
  }

  appview: Service | undefined
  pds: Service | undefined

  constructor(
    public db: Database,
    public createAuthHeaders: (
      aud: string,
      method: string,
    ) => Promise<AuthHeaders>,
    services: {
      appview?: {
        url: string
        did: DidString
      }
      pds?: {
        url: string
        did: DidString
        // Applied to every request to this one configured host. Never for a
        // PDS resolved from a DID document (see getPdsClientForRepo).
        headers?: Record<string, string>
      }
    },
  ) {
    if (services.appview) {
      this.appview = {
        client: new Client(
          { service: services.appview.url },
          { strictResponseProcessing: false },
        ),
        did: services.appview.did,
      }
    }
    if (services.pds) {
      this.pds = {
        client: new Client(
          { service: services.pds.url },
          {
            strictResponseProcessing: false,
            headers: services.pds.headers,
          },
        ),
        did: services.pds.did,
      }
    }
  }

  start() {
    this.poll(this.repoPollState, () => this.pushRepoEvents())
    this.poll(this.recordPollState, () => this.pushRecordEvents())
    this.poll(this.blobPollState, () => this.pushBlobEvents())
  }

  // event pusher may be configured with both appview and pds
  // but the takedown may particularly want only one of them
  // unless the target services are specified, we will push to all configured services
  getTakedownServices(targetServices: Set<string>): RepoPushEventType[] {
    let configured: RepoPushEventType[] = []
    if (this.pds) configured.push('pds_takedown')
    if (this.appview) configured.push('appview_takedown')

    if (!targetServices.size) {
      return configured
    }

    if (!targetServices.has('appview')) {
      configured = configured.filter(
        (service) => service !== 'appview_takedown',
      )
    }
    if (!targetServices.has('pds')) {
      configured = configured.filter((service) => service !== 'pds_takedown')
    }

    return configured
  }

  poll(state: PollState, fn: () => Promise<void>) {
    if (this.destroyed) return
    state.promise = fn()
      .catch((err) => {
        dbLogger.error({ err }, 'event push failed')
      })
      .finally(() => {
        state.timer = setTimeout(() => this.poll(state, fn), 30 * SECOND)
      })
  }

  async processAll() {
    await Promise.all([
      this.pushRepoEvents(),
      this.pushRecordEvents(),
      this.pushBlobEvents(),
      this.repoPollState.promise,
      this.recordPollState.promise,
      this.blobPollState.promise,
    ])
  }

  async destroy() {
    this.destroyed = true
    const destroyState = (state: PollState) => {
      if (state.timer) {
        clearTimeout(state.timer)
      }
      return state.promise
    }
    await Promise.all([
      destroyState(this.repoPollState),
      destroyState(this.recordPollState),
      destroyState(this.blobPollState),
    ])
  }

  async pushRepoEvents() {
    const retryBefore = new Date(Date.now() - RETRY_INTERVAL)
    const toPush = await this.db.db
      .selectFrom('repo_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .where((eb) =>
        eb.or([
          eb('lastAttempted', 'is', null),
          eb('lastAttempted', '<=', retryBefore),
        ]),
      )
      .execute()
    await this.pushQueue.addAll(
      toPush.map((evt) => () => this.attemptRepoEvent(evt.id, retryBefore)),
    )
  }

  async pushRecordEvents() {
    const retryBefore = new Date(Date.now() - RETRY_INTERVAL)
    const toPush = await this.db.db
      .selectFrom('record_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .where((eb) =>
        eb.or([
          eb('lastAttempted', 'is', null),
          eb('lastAttempted', '<=', retryBefore),
        ]),
      )
      .execute()
    await this.pushQueue.addAll(
      toPush.map((evt) => () => this.attemptRecordEvent(evt.id, retryBefore)),
    )
  }

  async pushBlobEvents() {
    const retryBefore = new Date(Date.now() - RETRY_INTERVAL)
    const toPush = await this.db.db
      .selectFrom('blob_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .where((eb) =>
        eb.or([
          eb('lastAttempted', 'is', null),
          eb('lastAttempted', '<=', retryBefore),
        ]),
      )
      .execute()
    await this.pushQueue.addAll(
      toPush.map((evt) => () => this.attemptBlobEvent(evt.id, retryBefore)),
    )
  }

  private async updateSubjectOnService(
    service: Service,
    subject: EventSubject,
    takedownRef: string | null,
  ): Promise<PushResult> {
    if (service.rateLimitedUntil && service.rateLimitedUntil > Date.now()) {
      return 'deferred'
    }
    const auth = await this.createAuthHeaders(
      service.did,
      com.atproto.admin.updateSubjectStatus.$lxm,
    )
    try {
      await retry(
        () =>
          service.client.call(
            com.atproto.admin.updateSubjectStatus,
            {
              subject,
              takedown: {
                applied: !!takedownRef,
                ref: takedownRef ?? undefined,
              },
            },
            auth,
          ),
        {
          retryable: (err) =>
            err instanceof XrpcResponseError
              ? err.status !== 429 && err.shouldRetry()
              : err instanceof XrpcFetchError ||
                err instanceof XrpcInternalError,
        },
      )
      if (service.rateLimitedUntil && service.rateLimitedUntil <= Date.now()) {
        service.rateLimitedUntil = undefined
      }
      return 'confirmed'
    } catch (err) {
      if (
        err instanceof XrpcResponseError &&
        err.status === 400 &&
        (err.error === 'NotFound' ||
          (err.error === 'InvalidRequest' &&
            err.message === 'Could not find account'))
      ) {
        return 'confirmed'
      }
      if (err instanceof XrpcResponseError && err.status === 429) {
        const resetAt = Number(err.headers.get('ratelimit-reset')) * SECOND
        service.rateLimitedUntil = Number.isFinite(resetAt)
          ? Math.max(resetAt, Date.now() + SECOND)
          : Date.now() + RETRY_INTERVAL
        dbLogger.warn(
          { err, rateLimitedUntil: new Date(service.rateLimitedUntil) },
          'event push rate limited',
        )
        return 'deferred'
      }
      dbLogger.error({ err, subject, takedownRef }, 'failed to push out event')
      return 'failed'
    }
  }

  async attemptRepoEvent(id: number, retryBefore?: Date) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('repo_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .$if(!!retryBefore, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb('lastAttempted', 'is', null),
              eb('lastAttempted', '<=', retryBefore!),
            ]),
          ),
        )
        .executeTakeFirst()
      if (!evt) return
      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      if (!service) return
      const subject = com.atproto.admin.defs.repoRef.$build({
        did: evt.subjectDid,
      })
      const result = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      if (result === 'deferred') return
      await dbTxn.db
        .updateTable('repo_push_event')
        .set(
          result === 'confirmed'
            ? { confirmedAt: new Date() }
            : {
                lastAttempted: new Date(),
                attempts: (evt.attempts ?? 0) + 1,
              },
        )
        .where('subjectDid', '=', evt.subjectDid)
        .where('eventType', '=', evt.eventType)
        .execute()
    })
  }

  async attemptRecordEvent(id: number, retryBefore?: Date) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('record_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .$if(!!retryBefore, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb('lastAttempted', 'is', null),
              eb('lastAttempted', '<=', retryBefore!),
            ]),
          ),
        )
        .executeTakeFirst()
      if (!evt) return
      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      if (!service) return
      const subject = com.atproto.repo.strongRef.$build({
        uri: evt.subjectUri,
        cid: evt.subjectCid,
      })
      const result = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      if (result === 'deferred') return
      await dbTxn.db
        .updateTable('record_push_event')
        .set(
          result === 'confirmed'
            ? { confirmedAt: new Date() }
            : {
                lastAttempted: new Date(),
                attempts: (evt.attempts ?? 0) + 1,
              },
        )
        .where('subjectUri', '=', evt.subjectUri)
        .where('eventType', '=', evt.eventType)
        .execute()
    })
  }

  async attemptBlobEvent(id: number, retryBefore?: Date) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('blob_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .$if(!!retryBefore, (qb) =>
          qb.where((eb) =>
            eb.or([
              eb('lastAttempted', 'is', null),
              eb('lastAttempted', '<=', retryBefore!),
            ]),
          ),
        )
        .executeTakeFirst()
      if (!evt) return

      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      if (!service) return
      const subject = com.atproto.admin.defs.repoBlobRef.$build({
        did: evt.subjectDid,
        cid: evt.subjectBlobCid,
      })
      const result = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      if (result === 'deferred') return
      await this.markBlobEventAttempt(dbTxn, evt, result === 'confirmed')
    })
  }

  async markBlobEventAttempt(
    dbTxn: Database,
    event: Selectable<BlobPushEvent>,
    succeeded: boolean,
  ) {
    await dbTxn.db
      .updateTable('blob_push_event')
      .set(
        succeeded
          ? { confirmedAt: new Date() }
          : {
              lastAttempted: new Date(),
              attempts: (event.attempts ?? 0) + 1,
            },
      )
      .where('subjectDid', '=', event.subjectDid)
      .where('subjectBlobCid', '=', event.subjectBlobCid)
      .where('eventType', '=', event.eventType)
      .execute()
  }

  async logBlobPushEvent(
    blobValues: Insertable<BlobPushEvent>[],
    takedownRef?: string | null,
  ) {
    return this.db.db
      .insertInto('blob_push_event')
      .values(blobValues)
      .onConflict((oc) =>
        oc.columns(['subjectDid', 'subjectBlobCid', 'eventType']).doUpdateSet({
          takedownRef,
          confirmedAt: null,
          attempts: 0,
          lastAttempted: null,
        }),
      )
      .returning([
        'id',
        'subjectDid',
        'subjectUri',
        'subjectBlobCid',
        'eventType',
      ])
      .execute()
  }
}

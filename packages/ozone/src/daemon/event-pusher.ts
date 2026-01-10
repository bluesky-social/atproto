import assert from 'node:assert'
import { Insertable, Selectable } from 'kysely'
import { AtpAgent } from '@atproto/api'
import { SECOND } from '@atproto/common'
import { Database } from '../db'
import { BlobPushEvent } from '../db/schema/blob_push_event'
import { RepoPushEventType } from '../db/schema/repo_push_event'
import { ids } from '../lexicon/lexicons'
import { InputSchema } from '../lexicon/types/com/atproto/admin/updateSubjectStatus'
import { dbLogger } from '../logger'
import { retryHttp } from '../util'

type EventSubject = InputSchema['subject']

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
  agent: AtpAgent
  did: string
}

export class EventPusher {
  destroyed = false

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
        did: string
      }
      pds?: {
        url: string
        did: string
      }
    },
  ) {
    if (services.appview) {
      this.appview = {
        agent: new AtpAgent({ service: services.appview.url }),
        did: services.appview.did,
      }
    }
    if (services.pds) {
      this.pds = {
        agent: new AtpAgent({ service: services.pds.url }),
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
    const toPush = await this.db.db
      .selectFrom('repo_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .execute()
    await Promise.all(toPush.map((evt) => this.attemptRepoEvent(evt.id)))
  }

  async pushRecordEvents() {
    const toPush = await this.db.db
      .selectFrom('record_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .execute()
    await Promise.all(toPush.map((evt) => this.attemptRecordEvent(evt.id)))
  }

  async pushBlobEvents() {
    const toPush = await this.db.db
      .selectFrom('blob_push_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('confirmedAt', 'is', null)
      .where('attempts', '<', 10)
      .execute()
    await Promise.all(toPush.map((evt) => this.attemptBlobEvent(evt.id)))
  }

  private async updateSubjectOnService(
    service: Service,
    subject: EventSubject,
    takedownRef: string | null,
  ): Promise<boolean> {
    const auth = await this.createAuthHeaders(
      service.did,
      ids.ComAtprotoAdminUpdateSubjectStatus,
    )
    try {
      await retryHttp(() =>
        service.agent.com.atproto.admin.updateSubjectStatus(
          {
            subject,
            takedown: {
              applied: !!takedownRef,
              ref: takedownRef ?? undefined,
            },
          },
          {
            ...auth,
            encoding: 'application/json',
          },
        ),
      )
      return true
    } catch (err) {
      dbLogger.error({ err, subject, takedownRef }, 'failed to push out event')
      return false
    }
  }

  async attemptRepoEvent(id: number) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('repo_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .executeTakeFirst()
      if (!evt) return
      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      assert(service)
      const subject = {
        $type: 'com.atproto.admin.defs#repoRef',
        did: evt.subjectDid,
      }
      const succeeded = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      await dbTxn.db
        .updateTable('repo_push_event')
        .set(
          succeeded
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

  async attemptRecordEvent(id: number) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('record_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .executeTakeFirst()
      if (!evt) return
      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      assert(service)
      const subject = {
        $type: 'com.atproto.repo.strongRef',
        uri: evt.subjectUri,
        cid: evt.subjectCid,
      }
      const succeeded = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      await dbTxn.db
        .updateTable('record_push_event')
        .set(
          succeeded
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

  async attemptBlobEvent(id: number) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('blob_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('confirmedAt', 'is', null)
        .executeTakeFirst()
      if (!evt) return

      const service = evt.eventType === 'pds_takedown' ? this.pds : this.appview
      assert(service)
      const subject = {
        $type: 'com.atproto.admin.defs#repoBlobRef',
        did: evt.subjectDid,
        cid: evt.subjectBlobCid,
      }
      const succeeded = await this.updateSubjectOnService(
        service,
        subject,
        evt.takedownRef,
      )
      await this.markBlobEventAttempt(dbTxn, evt, succeeded)
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

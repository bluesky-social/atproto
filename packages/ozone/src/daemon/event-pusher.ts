import AtpAgent from '@atproto/api'
import { SECOND } from '@atproto/common'
import Database from '../db'
import { retryHttp } from '../util'
import { RepoPushEvent } from '../db/schema/repo_push_event'
import { RecordPushEvent } from '../db/schema/record_push_event'
import { BlobPushEvent } from '../db/schema/blob_push_event'
import { dbLogger } from '../logger'
import { InputSchema } from '../lexicon/types/com/atproto/admin/updateSubjectStatus'
import { Selectable } from 'kysely'
import assert from 'assert'

type EventSubject = InputSchema['subject']

type PollState = {
  timer?: NodeJS.Timer
  promise: Promise<void>
  tries: number
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
    tries: 0,
  }
  recordPollState: PollState = {
    promise: Promise.resolve(),
    tries: 0,
  }
  blobPollState: PollState = {
    promise: Promise.resolve(),
    tries: 0,
  }

  appview: Service | undefined
  pds: Service | undefined

  constructor(
    public db: Database,
    public createAuthHeaders: (aud: string) => Promise<AuthHeaders>,
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

  poll(state: PollState, fn: () => Promise<boolean>) {
    if (this.destroyed) return
    state.promise = fn()
      .then((hadEvts: boolean) => {
        if (hadEvts) {
          state.tries = 0
        } else {
          state.tries++
        }
      })
      .catch((err) => {
        dbLogger.error({ err }, 'event push failed')
        state.tries++
      })
      .finally(() => {
        state.timer = setTimeout(
          () => this.poll(state, fn),
          exponentialBackoff(state.tries),
        )
      })
  }

  async processAll() {
    await Promise.all([
      this.pushRepoEvents(),
      this.pushRecordEvents(),
      this.pushBlobEvents(),
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
    return await this.db.transaction(async (dbTxn) => {
      const toPush = await dbTxn.db
        .selectFrom('repo_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('confirmedAt', 'is', null)
        .where('attempts', '<', 10)
        .execute()
      if (toPush.length === 0) return false
      await Promise.all(toPush.map((evt) => this.attemptRepoEvent(dbTxn, evt)))
      return true
    })
  }

  async pushRecordEvents() {
    return await this.db.transaction(async (dbTxn) => {
      const toPush = await dbTxn.db
        .selectFrom('record_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('confirmedAt', 'is', null)
        .execute()
      if (toPush.length === 0) return false
      await Promise.all(
        toPush.map((evt) => this.attemptRecordEvent(dbTxn, evt)),
      )
      return true
    })
  }

  async pushBlobEvents() {
    return await this.db.transaction(async (dbTxn) => {
      const toPush = await dbTxn.db
        .selectFrom('blob_push_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('confirmedAt', 'is', null)
        .execute()
      if (toPush.length === 0) return false
      await Promise.all(toPush.map((evt) => this.attemptBlobEvent(dbTxn, evt)))
      return true
    })
  }

  private async updateSubjectOnService(
    service: Service,
    subject: EventSubject,
    takedownRef: string | null,
  ): Promise<boolean> {
    const auth = await this.createAuthHeaders(service.did)
    try {
      retryHttp(() =>
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

  async attemptRepoEvent(txn: Database, evt: Selectable<RepoPushEvent>) {
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
    await txn.db
      .updateTable('repo_push_event')
      .set(
        succeeded
          ? { confirmedAt: new Date() }
          : {
              lastAttempted: new Date(),
              attempts: evt.attempts ?? 0 + 1,
            },
      )
      .where('subjectDid', '=', evt.subjectDid)
      .where('eventType', '=', evt.eventType)
      .execute()
  }

  async attemptRecordEvent(txn: Database, evt: Selectable<RecordPushEvent>) {
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
    await txn.db
      .updateTable('record_push_event')
      .set(
        succeeded
          ? { confirmedAt: new Date() }
          : {
              lastAttempted: new Date(),
              attempts: evt.attempts ?? 0 + 1,
            },
      )
      .where('subjectUri', '=', evt.subjectUri)
      .where('eventType', '=', evt.eventType)
      .execute()
  }

  async attemptBlobEvent(txn: Database, evt: Selectable<BlobPushEvent>) {
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
    await txn.db
      .updateTable('blob_push_event')
      .set(
        succeeded
          ? { confirmedAt: new Date() }
          : {
              lastAttempted: new Date(),
              attempts: evt.attempts ?? 0 + 1,
            },
      )
      .where('subjectDid', '=', evt.subjectDid)
      .where('subjectBlobCid', '=', evt.subjectBlobCid)
      .where('eventType', '=', evt.eventType)
      .execute()
  }
}

const exponentialBackoff = (tries: number): number => {
  return Math.min(Math.pow(10, tries), 30 * SECOND)
}

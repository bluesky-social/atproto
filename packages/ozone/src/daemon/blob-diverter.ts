import AtpAgent, { ComAtprotoSyncGetBlob } from '@atproto/api'
import { SECOND } from '@atproto/common'
import Database from '../db'
import { retryHttp } from '../util'
import { dbLogger } from '../logger'
import { BlobReportServiceConfig } from '../config'

type PollState = {
  timer?: NodeJS.Timer
  promise: Promise<void>
}

type Service = {
  agent: AtpAgent
  did: string
}

export class BlobDiverter {
  destroyed = false

  pollState: PollState = {
    promise: Promise.resolve(),
  }

  appview: Service | undefined
  pds: Service | undefined
  serviceConfig: BlobReportServiceConfig

  constructor(
    public db: Database,
    services: {
      serviceConfig: BlobReportServiceConfig
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
    this.serviceConfig = services.serviceConfig
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
    this.poll(this.pollState, () => this.divertBlob())
  }

  poll(state: PollState, fn: () => Promise<void>) {
    if (this.destroyed) return
    state.promise = fn()
      .catch((err) => {
        dbLogger.error({ err }, 'blob divert failed')
      })
      .finally(() => {
        state.timer = setTimeout(() => this.poll(state, fn), 30 * SECOND)
      })
  }

  async processAll() {
    await Promise.all([this.divertBlob(), this.pollState.promise])
  }

  async destroy() {
    this.destroyed = true
    const destroyState = (state: PollState) => {
      if (state.timer) {
        clearTimeout(state.timer)
      }
      return state.promise
    }
    await destroyState(this.pollState)
  }

  async divertBlob() {
    const toPush = await this.db.db
      .selectFrom('blob_divert_event')
      .select('id')
      .forUpdate()
      .skipLocked()
      .where('divertedAt', 'is', null)
      .where('attempts', '<', 10)
      .execute()
    await Promise.all(toPush.map((evt) => this.attemptBlobDivert(evt.id)))
  }

  private async getBlob(opts: { did: string; cid: string }) {
    // TODO: Is this safe to do or should we be reaching out to the pds instead?
    // do we need to resolve the pds url before we can call this?
    return this.pds?.agent.api.com.atproto.sync.getBlob(opts)
  }

  private async uploadBlob(
    blobResponse: ComAtprotoSyncGetBlob.Response,
    { subjectDid, subjectUri }: { subjectDid: string; subjectUri: string },
  ) {
    if (!this.serviceConfig.authToken || !this.serviceConfig.url) {
      return null
    }

    const url = `${this.serviceConfig.url}?did=${subjectDid}&uri=${subjectUri}`
    return fetch(url, {
      method: 'POST',
      body: blobResponse.data,
      headers: {
        Authorization: this.serviceConfig.authToken,
        'Content-Type':
          blobResponse.headers['content-type'] || 'application/octet-stream',
      },
    })
  }

  private async uploadBlobOnService({
    subjectDid,
    subjectUri,
    subjectBlobCid,
  }: {
    subjectDid: string
    subjectUri: string
    subjectBlobCid: string
  }): Promise<boolean> {
    try {
      if (!this.serviceConfig.authToken || !this.serviceConfig.url) {
        throw new Error('Blob divert service not configured')
      }

      const blobResult = await retryHttp(() =>
        this.getBlob({ did: subjectDid, cid: subjectBlobCid }),
      )

      if (!blobResult?.success) {
        throw new Error('Failed to get blob')
      }

      const uploadResult = await retryHttp(() =>
        this.uploadBlob(blobResult, { subjectDid, subjectUri }),
      )

      return uploadResult?.status === 200
    } catch (err) {
      dbLogger.error({ err }, 'failed to upload diverted blob')
      return false
    }
  }

  async attemptBlobDivert(id: number) {
    await this.db.transaction(async (dbTxn) => {
      const evt = await dbTxn.db
        .selectFrom('blob_divert_event')
        .selectAll()
        .forUpdate()
        .skipLocked()
        .where('id', '=', id)
        .where('divertedAt', 'is', null)
        .executeTakeFirst()
      if (!evt) return

      const succeeded = await this.uploadBlobOnService(evt)
      await dbTxn.db
        .updateTable('blob_divert_event')
        .set(
          succeeded
            ? { divertedAt: new Date() }
            : {
                lastAttempted: new Date(),
                attempts: (evt.attempts ?? 0) + 1,
              },
        )
        .where('subjectDid', '=', evt.subjectDid)
        .where('subjectBlobCid', '=', evt.subjectBlobCid)
        .execute()
    })
  }

  async logDivertEvent(values: {
    subjectDid: string
    subjectUri: string
    subjectBlobCid: string
  }) {
    return this.db.db
      .insertInto('blob_divert_event')
      .values(values)
      .onConflict((oc) =>
        oc.columns(['subjectDid', 'subjectBlobCid']).doUpdateSet({
          divertedAt: null,
          attempts: 0,
          lastAttempted: null,
        }),
      )
      .returning('id')
      .execute()
  }
}

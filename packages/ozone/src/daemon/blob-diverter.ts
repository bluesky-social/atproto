import {
  SECOND,
  VerifyCidTransform,
  forwardStreamErrors,
  getPdsEndpoint,
} from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import axios from 'axios'
import { Readable } from 'stream'
import { CID } from 'multiformats/cid'

import Database from '../db'
import { retryHttp } from '../util'
import { dbLogger } from '../logger'
import { BlobReportServiceConfig } from '../config'

type PollState = {
  timer?: NodeJS.Timer
  promise: Promise<void>
}

export class BlobDiverter {
  destroyed = false

  pollState: PollState = {
    promise: Promise.resolve(),
  }

  serviceConfig: BlobReportServiceConfig
  idResolver: IdResolver

  constructor(
    public db: Database,
    services: {
      idResolver: IdResolver
      serviceConfig: BlobReportServiceConfig
    },
  ) {
    this.serviceConfig = services.serviceConfig
    this.idResolver = services.idResolver
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

  private async getBlob({
    pds,
    did,
    cid,
  }: {
    pds: string
    did: string
    cid: string
  }) {
    const blobResponse = await axios.get(
      `${pds}/xrpc/com.atproto.sync.getBlob`,
      {
        params: { did, cid },
        decompress: true,
        responseType: 'stream',
        timeout: 5000, // 5sec of inactivity on the connection
      },
    )
    const imageStream: Readable = blobResponse.data
    const verifyCid = new VerifyCidTransform(CID.parse(cid))
    forwardStreamErrors(imageStream, verifyCid)

    return {
      contentType:
        blobResponse.headers['content-type'] || 'application/octet-stream',
      imageStream: imageStream.pipe(verifyCid),
    }
  }

  private async uploadBlob(
    {
      imageStream,
      contentType,
    }: { imageStream: Readable; contentType: string },
    { subjectDid, subjectUri }: { subjectDid: string; subjectUri: string },
  ) {
    if (!this.serviceConfig.authToken || !this.serviceConfig.url) {
      return false
    }

    const url = `${this.serviceConfig.url}?did=${subjectDid}&uri=${subjectUri}`
    const result = await axios(url, {
      method: 'POST',
      data: imageStream,
      headers: {
        Authorization: this.serviceConfig.authToken,
        'Content-Type': contentType,
      },
    })

    return result.status === 200
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

      const didDoc = await this.idResolver.did.resolve(subjectDid)

      if (!didDoc) {
        throw new Error('Error resolving DID')
      }

      const pds = getPdsEndpoint(didDoc)

      if (!pds) {
        throw new Error('Error resolving PDS')
      }

      const { imageStream, contentType } = await retryHttp(() =>
        this.getBlob({ pds, did: subjectDid, cid: subjectBlobCid }),
      )

      const uploadResult = await retryHttp(() =>
        this.uploadBlob(
          { imageStream, contentType },
          { subjectDid, subjectUri },
        ),
      )

      return uploadResult
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

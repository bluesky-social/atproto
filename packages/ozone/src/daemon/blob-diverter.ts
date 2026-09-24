import { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { CID } from 'multiformats/cid'
import * as undici from 'undici'
import {
  VerifyCidTransform,
  allFulfilled,
  getPdsEndpoint,
} from '@atproto/common'
import type { IdResolver } from '@atproto/identity'
import type { AtUriString, DidString } from '@atproto/lex'
import type { BlobDivertConfig } from '../config/index.js'
import type { Database } from '../db/index.js'
import { BodyTimeoutTransform, createSafeFetch } from '../safe-fetch.js'
import { UpstreamHttpError, retryHttp } from '../util.js'

const BLOB_HEADERS_TIMEOUT = 30e3
const BLOB_BODY_TIMEOUT = 120e3
const BLOB_RESPONSE_MAX_SIZE = 100 * 1024 * 1024
const safeBlobFetch = createSafeFetch({
  responseMaxSize: BLOB_RESPONSE_MAX_SIZE,
})

export class BlobDiverter {
  serviceConfig: BlobDivertConfig
  idResolver: IdResolver
  private readonly fetch: typeof globalThis.fetch

  constructor(
    public db: Database,
    services: {
      idResolver: IdResolver
      serviceConfig: BlobDivertConfig
      devMode?: boolean
    },
  ) {
    this.serviceConfig = services.serviceConfig
    this.idResolver = services.idResolver
    this.fetch = services.devMode ? globalThis.fetch : safeBlobFetch
  }

  /**
   * @throws {UpstreamHttpError} so that retryHttp can handle retries
   */
  async getBlob(options: GetBlobOptions): Promise<Blob> {
    const blobUrl = getBlobUrl(options)

    const headersController = new AbortController()
    const headersTimer = setTimeout(
      () => headersController.abort(),
      BLOB_HEADERS_TIMEOUT,
    )
    headersTimer.unref()

    const blobResponse = await this.fetch(blobUrl, {
      signal: headersController.signal,
    })
      .catch((err) => {
        throw asXrpcClientError(err, `Error fetching blob ${options.cid}`)
      })
      .finally(() => clearTimeout(headersTimer))

    if (blobResponse.status !== 200) {
      await blobResponse.body?.cancel()
      throw new UpstreamHttpError(
        blobResponse.status,
        `Error downloading blob ${options.cid}`,
      )
    }

    try {
      if (!blobResponse.body) {
        throw new Error('Blob response has no body')
      }

      const type = blobResponse.headers.get('content-type')
      const verifier = new VerifyCidTransform(CID.parse(options.cid))

      void pipeline([
        Readable.fromWeb(blobResponse.body),
        new BodyTimeoutTransform(BLOB_BODY_TIMEOUT),
        verifier,
      ]).catch((_err) => {})

      return {
        type: type ?? 'application/octet-stream',
        stream: verifier,
      }
    } catch (err) {
      await blobResponse.body?.cancel()
      throw err
    }
  }

  /**
   * @throws {UpstreamHttpError} so that retryHttp can handle retries
   */
  async uploadBlob(blob: Blob, report: ReportBlobOptions) {
    const uploadUrl = reportBlobUrl(this.serviceConfig.url, report)

    const result = await undici
      .request(uploadUrl, {
        method: 'POST',
        body: blob.stream,
        headersTimeout: 30e3,
        bodyTimeout: 10e3,
        headers: {
          Authorization: basicAuth('admin', this.serviceConfig.adminPassword),
          'content-type': blob.type,
        },
      })
      .catch((err) => {
        throw asXrpcClientError(err, `Error uploading blob ${report.did}`)
      })

    if (result.statusCode !== 200) {
      await result.body.dump()
      throw new UpstreamHttpError(
        result.statusCode,
        `Error uploading blob ${report.did}`,
      )
    }

    await finished(result.body.resume())
  }

  async uploadBlobOnService({
    subjectDid: did,
    subjectUri: uri,
    subjectBlobCids,
  }: {
    subjectDid: DidString
    subjectUri: AtUriString | null
    subjectBlobCids: string[]
  }): Promise<void> {
    const didDoc = await this.idResolver.did.resolve(did)
    if (!didDoc) throw new Error('Error resolving DID')

    const pds = getPdsEndpoint(didDoc)
    if (!pds) throw new Error('Error resolving PDS')

    await allFulfilled(
      subjectBlobCids.map((cid) =>
        retryHttp(async () => {
          // attempt to download and upload within the same retry block since
          // the blob stream is not reusable
          const blob = await this.getBlob({ pds, cid, did })
          return this.uploadBlob(blob, { did, uri })
        }),
      ),
    ).catch((err) => {
      throw new UpstreamHttpError(502, 'Failed to process blobs', {
        cause: err,
      })
    })
  }
}

const basicAuth = (username: string, password: string) => {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

type Blob = {
  type: string
  stream: Readable
}

type GetBlobOptions = {
  pds: string
  did: DidString
  cid: string
}

function getBlobUrl({ pds, did, cid }: GetBlobOptions): URL {
  const url = new URL(`/xrpc/com.atproto.sync.getBlob`, pds)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid)
  return url
}

type ReportBlobOptions = {
  did: DidString
  uri: AtUriString | null
}

function reportBlobUrl(service: string, { did, uri }: ReportBlobOptions): URL {
  const url = new URL(`/xrpc/com.atproto.unspecced.reportBlob`, service)
  url.searchParams.set('did', did)
  if (uri != null) url.searchParams.set('uri', uri)
  return url
}

function asXrpcClientError(err: unknown, message: string) {
  return new UpstreamHttpError(undefined, message, { cause: err })
}

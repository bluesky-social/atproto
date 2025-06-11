import { Readable } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'
import { CID } from 'multiformats/cid'
import * as undici from 'undici'
import {
  VerifyCidTransform,
  allFulfilled,
  createDecoders,
  getPdsEndpoint,
} from '@atproto/common'
import { IdResolver } from '@atproto/identity'
import { ResponseType, XRPCError } from '@atproto/xrpc'
import { BlobDivertConfig } from '../config'
import { Database } from '../db'
import { retryHttp } from '../util'

export class BlobDiverter {
  serviceConfig: BlobDivertConfig
  idResolver: IdResolver

  constructor(
    public db: Database,
    services: {
      idResolver: IdResolver
      serviceConfig: BlobDivertConfig
    },
  ) {
    this.serviceConfig = services.serviceConfig
    this.idResolver = services.idResolver
  }

  /**
   * @throws {XRPCError} so that retryHttp can handle retries
   */
  async getBlob(options: GetBlobOptions): Promise<Blob> {
    const blobUrl = getBlobUrl(options)

    const blobResponse = await undici
      .request(blobUrl, {
        headersTimeout: 10e3,
        bodyTimeout: 30e3,
      })
      .catch((err) => {
        throw asXrpcClientError(err, `Error fetching blob ${options.cid}`)
      })

    if (blobResponse.statusCode !== 200) {
      await blobResponse.body.dump()
      throw new XRPCError(
        blobResponse.statusCode,
        undefined,
        `Error downloading blob ${options.cid}`,
      )
    }

    try {
      const type = blobResponse.headers['content-type']
      const encoding = blobResponse.headers['content-encoding']

      const verifier = new VerifyCidTransform(CID.parse(options.cid))

      void pipeline([
        blobResponse.body,
        ...createDecoders(encoding),
        verifier,
      ]).catch((_err) => {})

      return {
        type: typeof type === 'string' ? type : 'application/octet-stream',
        stream: verifier,
      }
    } catch (err) {
      // Typically un-supported content encoding
      await blobResponse.body.dump()
      throw err
    }
  }

  /**
   * @throws {XRPCError} so that retryHttp can handle retries
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
      throw new XRPCError(
        result.statusCode,
        undefined,
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
    subjectDid: string
    subjectUri: string | null
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
      throw new XRPCError(
        ResponseType.UpstreamFailure,
        undefined,
        'Failed to process blobs',
        undefined,
        { cause: err },
      )
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
  did: string
  cid: string
}

function getBlobUrl({ pds, did, cid }: GetBlobOptions): URL {
  const url = new URL(`/xrpc/com.atproto.sync.getBlob`, pds)
  url.searchParams.set('did', did)
  url.searchParams.set('cid', cid)
  return url
}

type ReportBlobOptions = {
  did: string
  uri: string | null
}

function reportBlobUrl(service: string, { did, uri }: ReportBlobOptions): URL {
  const url = new URL(`/xrpc/com.atproto.unspecced.reportBlob`, service)
  url.searchParams.set('did', did)
  if (uri != null) url.searchParams.set('uri', uri)
  return url
}

function asXrpcClientError(err: unknown, message: string) {
  return new XRPCError(ResponseType.Unknown, undefined, message, undefined, {
    cause: err,
  })
}

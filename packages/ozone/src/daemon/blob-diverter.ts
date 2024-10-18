import {
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
import { BlobDivertConfig } from '../config'

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

  async sendImage({
    url,
    imageStream,
    contentType,
  }: {
    url: string
    imageStream: Readable
    contentType: string
  }) {
    const result = await axios(url, {
      method: 'POST',
      data: imageStream,
      headers: {
        Authorization: basicAuth('admin', this.serviceConfig.adminPassword),
        'Content-Type': contentType,
      },
    })

    return result.status === 200
  }

  private async uploadBlob(
    {
      imageStream,
      contentType,
    }: { imageStream: Readable; contentType: string },
    {
      subjectDid,
      subjectUri,
    }: { subjectDid: string; subjectUri: string | null },
  ) {
    const url = new URL(
      `${this.serviceConfig.url}/xrpc/com.atproto.unspecced.reportBlob`,
    )
    url.searchParams.set('did', subjectDid)
    if (subjectUri) url.searchParams.set('uri', subjectUri)
    const result = await this.sendImage({
      url: url.toString(),
      imageStream,
      contentType,
    })

    return result
  }

  async uploadBlobOnService({
    subjectDid,
    subjectUri,
    subjectBlobCids,
  }: {
    subjectDid: string
    subjectUri: string | null
    subjectBlobCids: string[]
  }): Promise<boolean> {
    const didDoc = await this.idResolver.did.resolve(subjectDid)

    if (!didDoc) {
      throw new Error('Error resolving DID')
    }

    const pds = getPdsEndpoint(didDoc)

    if (!pds) {
      throw new Error('Error resolving PDS')
    }

    // attempt to download and upload within the same retry block since the imageStream is not reusable
    const uploadResult = await Promise.all(
      subjectBlobCids.map((cid) =>
        retryHttp(async () => {
          const { imageStream, contentType } = await this.getBlob({
            pds,
            cid,
            did: subjectDid,
          })
          return this.uploadBlob(
            { imageStream, contentType },
            { subjectDid, subjectUri },
          )
        }),
      ),
    )

    if (uploadResult.includes(false)) {
      throw new Error(`Error uploading blob ${subjectUri}`)
    }

    return true
  }
}

const basicAuth = (username: string, password: string) => {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

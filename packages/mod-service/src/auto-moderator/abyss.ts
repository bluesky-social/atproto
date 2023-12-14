import axios from 'axios'
import { CID } from 'multiformats/cid'
import { AtUri } from '@atproto/syntax'
import * as ui8 from 'uint8arrays'
import { resolveBlob } from '../api/blob-resolver'
import { retryHttp } from '../util/retry'
import { PrimaryDatabase } from '../db'
import { IdResolver } from '@atproto/identity'
import { labelerLogger as log } from '../logger'

export interface ImageFlagger {
  scanImage(did: string, cid: CID, uri: AtUri): Promise<string[]>
}

export class Abyss implements ImageFlagger {
  protected auth: string

  constructor(
    public endpoint: string,
    protected password: string,
    public ctx: { db: PrimaryDatabase; idResolver: IdResolver },
  ) {
    this.auth = basicAuth(this.password)
  }

  async scanImage(did: string, cid: CID, uri: AtUri): Promise<string[]> {
    const start = Date.now()
    const res = await retryHttp(async () => {
      try {
        return await this.makeReq(did, cid, uri)
      } catch (err) {
        log.warn({ err, did, cid: cid.toString() }, 'abyss request failed')
        throw err
      }
    })
    log.info(
      { res, did, cid: cid.toString(), duration: Date.now() - start },
      'abyss response',
    )
    return this.parseRes(res)
  }

  async makeReq(did: string, cid: CID, uri: AtUri): Promise<ScannerResp> {
    const { stream, contentType } = await resolveBlob(
      did,
      cid,
      this.ctx.db,
      this.ctx.idResolver,
    )
    const { data } = await axios.post(
      this.getReqUrl({ did, uri: uri.toString() }),
      stream,
      {
        headers: {
          'Content-Type': contentType,
          authorization: this.auth,
        },
        timeout: 10000,
      },
    )
    return data
  }

  parseRes(res: ScannerResp): string[] {
    if (!res.match || res.match.status !== 'success') {
      return []
    }
    const labels: string[] = []
    for (const hit of res.match.hits) {
      if (TAKEDOWN_LABELS.includes(hit.label)) {
        labels.push(hit.label)
      }
    }
    return labels
  }

  getReqUrl(params: { did: string; uri: string }) {
    const search = new URLSearchParams(params)
    return `${
      this.endpoint
    }/xrpc/com.atproto.unspecced.scanBlob?${search.toString()}`
  }
}

const TAKEDOWN_LABELS = ['csam', 'csem']

type ScannerResp = {
  blob: unknown
  match?: {
    status: string
    hits: ScannerHit[]
  }
  classify?: {
    hits?: unknown[]
  }
  review?: {
    state?: string
    ticketId?: string
  }
}

type ScannerHit = {
  hashType: string
  hashValue: string
  label: string
  corpus: string
}

const basicAuth = (password: string) => {
  return (
    'Basic ' +
    ui8.toString(ui8.fromString(`admin:${password}`, 'utf8'), 'base64pad')
  )
}

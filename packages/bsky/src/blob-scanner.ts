import axios from 'axios'
import { CID } from 'multiformats/cid'
import * as ui8 from 'uint8arrays'
import { resolveBlob } from './api/blob-resolver'
import { retryHttp } from './util/retry'
import { PrimaryDatabase } from './db'
import { IdResolver } from '@atproto/identity'
import { labelerLogger as log } from './logger'

export class BlobScanner {
  protected auth: string

  constructor(
    public ctx: { db: PrimaryDatabase; idResolver: IdResolver },
    public endpoint: string,
    protected password: string,
  ) {
    this.auth = basicAuth(this.password)
  }

  async scanImage(did: string, cid: CID): Promise<ScannerResult | null> {
    const res = await retryHttp(async () => {
      try {
        return await this.makeReq(did, cid)
      } catch (err) {
        log.warn(
          { err, did, cid: cid.toString() },
          'blob scanner request failed',
        )
        throw err
      }
    })
    return this.parseRes(res)
  }

  async makeReq(did: string, cid: CID): Promise<ScannerResp> {
    const { stream, contentType } = await resolveBlob(
      did,
      cid,
      this.ctx.db,
      this.ctx.idResolver,
    )
    const { data } = await axios.post(this.getReqUrl({ did }), stream, {
      headers: {
        'Content-Type': contentType,
        authorization: this.auth,
      },
    })
    return data
  }

  parseRes(res: ScannerResp): ScannerResult | null {
    if (!res.match || res.match.status !== 'success') {
      return null
    }
    const labels: string[] = []
    let shouldTakedown = false
    for (const hit of res.match.hits) {
      labels.push(hit.label)
      if (TAKEDOWN_LABELS.includes(hit.label)) {
        shouldTakedown = true
      }
    }
    return {
      labels,
      shouldTakedown,
    }
  }

  getReqUrl(params: { did: string }) {
    return `${this.endpoint}/xrpc/com.atproto.unspecced.scanBlob?did=${params.did}`
  }
}

const TAKEDOWN_LABELS = ['csam', 'csem']

type ScannerResult = {
  labels: string[]
  shouldTakedown: boolean
}

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

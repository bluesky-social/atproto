import { sql } from 'kysely'
import { cborEncode, noUndefinedVals } from '@atproto/common'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import type { DidString } from '@atproto/lex'
import { Client, toDatetimeString } from '@atproto/lex'
import type { LabelRow } from '../db/schema/label.js'
import type { DbRef } from '../db/types.js'
import type { com } from '../lexicons/index.js'
import { createSafeFetch } from '../safe-fetch.js'

const safePdsFetch = createSafeFetch()

export type SignedLabel = com.atproto.label.defs.Label & { sig: Uint8Array }

export const formatLabel = (row: LabelRow): com.atproto.label.defs.Label => {
  return noUndefinedVals({
    ver: 1,
    src: row.src,
    uri: row.uri,
    cid: row.cid === '' ? undefined : row.cid,
    val: row.val,
    neg: row.neg === true ? true : undefined,
    cts: row.cts,
    exp: row.exp ?? undefined,
    sig: row.sig ? new Uint8Array(row.sig) : undefined,
  } satisfies com.atproto.label.defs.Label) as unknown as com.atproto.label.defs.Label
}

export const formatLabelRow = (
  label: com.atproto.label.defs.Label,
  signingKeyId?: number,
): Omit<LabelRow, 'id'> => {
  return {
    src: label.src,
    uri: label.uri,
    cid: label.cid ?? '',
    val: label.val,
    neg: !!label.neg,
    cts: label.cts,
    exp: label.exp ?? null,
    sig: label.sig ? Buffer.from(label.sig) : null,
    signingKeyId: signingKeyId ?? null,
  }
}

export const signLabel = async (
  label: com.atproto.label.defs.Label,
  signingKey: Keypair,
): Promise<SignedLabel> => {
  const { ver, src, uri, cid, val, neg, cts, exp } = label
  // @TODO cborEncode now ignores undefined properties, so we might not need to
  // reformat the label here. We might want to consider this if we ever re-visit
  // the logic below:
  const reformatted = noUndefinedVals({
    ver: ver ?? 1,
    src,
    uri,
    cid,
    val,
    neg: neg === true ? true : undefined,
    cts,
    exp,
  } satisfies com.atproto.label.defs.Label) as unknown as com.atproto.label.defs.Label

  const bytes = cborEncode(reformatted)
  const sig = await signingKey.sign(bytes)
  return {
    ...reformatted,
    sig,
  }
}

export const getPdsClientForRepo = async (
  idResolver: IdResolver,
  did: DidString,
  devMode?: boolean,
) => {
  const { pds } = await idResolver.did.resolveAtprotoData(did)
  const url = new URL(pds)
  if (!devMode && url.protocol !== 'https:') {
    return { url, client: null }
  }

  return {
    url,
    client: new Client(
      {
        service: url,
        fetch: devMode ? globalThis.fetch : safePdsFetch,
      },
      {
        // Trust internal services to send us well-formed responses
        strictResponseProcessing: false,
      },
    ),
  }
}

export const dateFromDatetime = (datetime: Date) => {
  const [date] = toDatetimeString(datetime).split('T')
  return date
}

export const dateFromDbDatetime = (dateRef: DbRef) => {
  return sql<string>`SPLIT_PART(${dateRef}, 'T', 1)`
}

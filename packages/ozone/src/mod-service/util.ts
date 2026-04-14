import net from 'node:net'
import { sql } from 'kysely'
import AtpAgent from '@atproto/api'
import { cborEncode, noUndefinedVals } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { LabelRow } from '../db/schema/label'
import { DbRef } from '../db/types'
import { Label } from '../lexicon/types/com/atproto/label/defs'

export type SignedLabel = Label & { sig: Uint8Array }

export const formatLabel = (row: LabelRow): Label => {
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
  } satisfies Label) as unknown as Label
}

export const formatLabelRow = (
  label: Label,
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
  label: Label,
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
  } satisfies Label) as unknown as Label

  const bytes = cborEncode(reformatted)
  const sig = await signingKey.sign(bytes)
  return {
    ...reformatted,
    sig,
  }
}

export const isSafeUrl = (url: URL) => {
  if (url.protocol !== 'https:') return false
  if (!url.hostname || url.hostname === 'localhost') return false
  if (net.isIP(url.hostname) !== 0) return false
  return true
}

export const getPdsAgentForRepo = async (
  idResolver: IdResolver,
  did: string,
  devMode?: boolean,
) => {
  const { pds } = await idResolver.did.resolveAtprotoData(did)
  const url = new URL(pds)
  if (!devMode && !isSafeUrl(url)) {
    return { url, agent: null }
  }

  return { url, agent: new AtpAgent({ service: url }) }
}

export const dateFromDatetime = (datetime: Date) => {
  const [date] = datetime.toISOString().split('T')
  return date
}

export const dateFromDbDatetime = (dateRef: DbRef) => {
  return sql<string>`SPLIT_PART(${dateRef}, 'T', 1)`
}

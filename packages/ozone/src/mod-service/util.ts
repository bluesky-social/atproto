import { cborEncode, noUndefinedVals } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { LabelRow } from '../db/schema/label'
import { Label } from '../lexicon/types/com/atproto/label/defs'

export type SignedLabel = Label & { sig: Uint8Array }

export const formatLabel = (row: LabelRow): Label => {
  return noUndefinedVals({
    ver: 1,
    src: row.src,
    uri: row.uri,
    cid: row.cid === '' ? undefined : row.cid,
    val: row.val,
    neg: row.neg,
    cts: row.cts,
    exp: row.exp ?? undefined,
    sig: row.sig ? new Uint8Array(row.sig) : undefined,
  }) as Label
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
  const reformatted = noUndefinedVals({
    ver: ver ?? 1,
    src,
    uri,
    cid,
    val,
    neg,
    cts,
    exp,
  }) as Label

  const bytes = cborEncode(reformatted)
  const sig = await signingKey.sign(bytes)
  return {
    ...reformatted,
    sig,
  }
}

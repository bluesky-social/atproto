import * as ui8 from 'uint8arrays'
import { cborEncode, noUndefinedVals } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { LabelRow } from '../db/schema/label'
import { Label } from '../lexicon/types/com/atproto/label/defs'

export type SignedLabel = Label & { sig: string }

export const formatLabel = (row: LabelRow): Label => {
  return noUndefinedVals({
    src: row.src,
    uri: row.uri,
    cid: row.cid === '' ? undefined : row.cid,
    val: row.val,
    neg: row.neg,
    cts: row.cts,
    sig: row.sig ?? undefined,
  }) as Label
}

export const signLabel = async (
  label: Label,
  signingKey: Keypair,
): Promise<SignedLabel> => {
  const { src, uri, cid, val, neg, cts } = label
  const reformatted = noUndefinedVals({
    src,
    uri,
    cid,
    val,
    neg,
    cts,
  }) as Label

  const bytes = cborEncode(reformatted)
  const sigBytes = await signingKey.sign(bytes)
  return {
    ...reformatted,
    sig: ui8.toString(sigBytes, 'base64'),
  }
}

import * as ui8 from 'uint8arrays'
import { cborEncode } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { LabelRow } from '../db/schema/label'
import { Label } from '../lexicon/types/com/atproto/label/defs'

export type SignedLabel = Label & { sig: string }

export const formatLabel = (row: LabelRow): Label => {
  return {
    src: row.src,
    uri: row.uri,
    cid: row.cid === '' ? undefined : row.cid,
    val: row.val,
    neg: row.neg,
    cts: row.cts,
    sig: row.sig ?? undefined,
  }
}

export const signLabel = async (
  label: Label,
  signingKey: Keypair,
): Promise<SignedLabel> => {
  const { sig: _, ...rest } = label
  const bytes = cborEncode(rest)
  const sigBytes = await signingKey.sign(bytes)
  return {
    ...rest,
    sig: ui8.toString(sigBytes, 'base64'),
  }
}

import * as mf from 'multiformats/cid'
import { z } from 'zod'
import * as ucan from 'ucans'

const cid = z.instanceof(mf.CID)
export type CID = z.infer<typeof cid>

export const isCid = (str: string): boolean => {
  try {
    mf.CID.parse(str)
    return true
  } catch (err) {
    return false
  }
}

const strToCid = z
  .string()
  .refine(isCid, { message: 'Not a valid CID' })
  .transform(mf.CID.parse)

// @TODO improve our DID representation
const did = z.string()
export type DID = z.infer<typeof did>

const bytes = z.instanceof(Uint8Array)
export type Bytes = z.infer<typeof bytes>

export type Keypair = ucan.Keypair & ucan.Didable

const strToInt = z
  .string()
  .refine((str) => !isNaN(parseInt(str)), {
    message: 'Cannot parse string to integer',
  })
  .transform(parseInt)

export const schema = {
  string: z.string(),
  cid,
  strToCid,
  did,
  bytes,
  strToInt,
}

import * as mf from 'multiformats/cid'
import { z } from 'zod'

const cid = z
  .any()
  .refine((obj: unknown) => mf.CID.asCID(obj) !== null, {
    message: 'Not a CID',
  })
  .transform((obj: unknown) => mf.CID.asCID(obj) as mf.CID)

// const cid = z.instanceof(mf.CID)
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
  .transform((str: string) => mf.CID.parse(str))

const did = z.string()
export type DID = z.infer<typeof did>

const bytes = z.instanceof(Uint8Array)
export type Bytes = z.infer<typeof bytes>

const strToInt = z
  .string()
  .refine((str) => !isNaN(parseInt(str)), {
    message: 'Cannot parse string to integer',
  })
  .transform((str) => parseInt(str))

const strToBool = z.string().transform((str) => str === 'true' || str === 't')

export const def = {
  string: z.string(),
  cid,
  strToCid,
  did,
  bytes,
  strToInt,
  strToBool,
}

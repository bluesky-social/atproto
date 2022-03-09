import * as mf from 'multiformats/cid'
import { z } from 'zod'

export const cid = z.instanceof(mf.CID)
export type CID = z.infer<typeof cid>

// @TODO improve our DID represnetation
export const did = z.string()
export type DID = z.infer<typeof did>

export const bytes = z.instanceof(Uint8Array)
export type Bytes = z.infer<typeof bytes>

import * as mf from 'multiformats/cid'
import { z } from 'zod'
import { Def } from './check'

const cidSchema = z
  .any()
  .refine((obj: unknown) => mf.CID.asCID(obj) !== null, {
    message: 'Not a CID',
  })
  .transform((obj: unknown) => mf.CID.asCID(obj) as mf.CID)

export const schema = {
  cid: cidSchema,
  bytes: z.instanceof(Uint8Array),
  string: z.string(),
  record: z.record(z.string(), z.unknown()),
  unknown: z.unknown(),
}

export const def = {
  cid: {
    name: 'cid',
    schema: schema.cid,
  } as Def<mf.CID>,
  bytes: {
    name: 'bytes',
    schema: schema.bytes,
  } as Def<Uint8Array>,
  string: {
    name: 'string',
    schema: schema.string,
  } as Def<string>,
  record: {
    name: 'record',
    schema: schema.record,
  } as Def<Record<string, unknown>>,
  unknown: {
    name: 'unknown',
    schema: schema.unknown,
  } as Def<unknown>,
}

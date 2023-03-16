import * as mf from 'multiformats/cid'
import { z } from 'zod'
import { Def } from './check'

const cidSchema = z
  .any()
  .refine((obj: unknown) => mf.CID.asCID(obj) !== null, {
    message: 'Not a CID',
  })
  .transform((obj: unknown) => mf.CID.asCID(obj) as mf.CID)

const blobRefType = z.union([
  z.literal('blob'),
  z.literal('image'),
  z.literal('video'),
  z.literal('audio'),
])

const jsonBlobRefSchema = z.object({
  $type: blobRefType,
  ref: z.object({
    '/': z.string(),
  }),
  mimeType: z.string(),
})

export const schema = {
  cid: cidSchema,
  jsonBlobRef: jsonBlobRefSchema,
  bytes: z.instanceof(Uint8Array),
  string: z.string(),
  array: z.array(z.unknown()),
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

export type ArrayEl<A> = A extends readonly (infer T)[] ? T : never

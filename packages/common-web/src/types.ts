import { CID } from 'multiformats/cid'
import { z } from 'zod'
import { Def } from './check'

const cidSchema = z
  .any()
  .refine((obj: unknown) => CID.asCID(obj) !== null, {
    message: 'Not a CID',
  })
  .transform((obj: unknown) => CID.asCID(obj) as CID)

export const schema = {
  cid: cidSchema,
  bytes: z.instanceof(Uint8Array),
  string: z.string(),
  array: z.array(z.unknown()),
  map: z.record(z.string(), z.unknown()),
  unknown: z.unknown(),
}

export const def = {
  cid: {
    name: 'cid',
    schema: schema.cid,
  } as Def<CID>,
  bytes: {
    name: 'bytes',
    schema: schema.bytes,
  } as Def<Uint8Array>,
  string: {
    name: 'string',
    schema: schema.string,
  } as Def<string>,
  map: {
    name: 'map',
    schema: schema.map,
  } as Def<Record<string, unknown>>,
  unknown: {
    name: 'unknown',
    schema: schema.unknown,
  } as Def<unknown>,
}

export type ArrayEl<A> = A extends readonly (infer T)[] ? T : never

export type NotEmptyArray<T> = [T, ...T[]]

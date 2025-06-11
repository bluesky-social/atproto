import { CID } from 'multiformats/cid'
import { z } from 'zod'
import { Def } from './check'

const cidSchema = z.unknown().transform((obj, ctx): CID => {
  const cid = CID.asCID(obj)

  if (cid == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Not a valid CID',
    })
    return z.NEVER
  }

  return cid
})

const carHeader = z.object({
  version: z.literal(1),
  roots: z.array(cidSchema),
})
export type CarHeader = z.infer<typeof carHeader>

export const schema = {
  cid: cidSchema,
  carHeader,
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
  carHeader: {
    name: 'CAR header',
    schema: schema.carHeader,
  } as Def<CarHeader>,
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

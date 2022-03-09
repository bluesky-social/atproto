import { z } from 'zod'
import { CID, DID, cid, did } from './types.js'

export const isCID = (obj: unknown): obj is CID => {
  return cid.safeParse(obj).success
}

export const assureCID = (obj: unknown): CID => {
  return cid.parse(obj)
}

export const isDID = (obj: unknown): obj is DID => {
  return did.safeParse(obj).success
}

export const assureDID = (obj: unknown): DID => {
  return did.parse(obj)
}

export const isString = (obj: unknown): obj is string => {
  return z.string().safeParse(obj).success
}

export const assureString = (obj: unknown): string => {
  return z.string().parse(obj)
}

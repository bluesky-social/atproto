import { CID } from 'multiformats/cid'
import { DID } from './types.js'

export const assure = <T>(
  obj: unknown,
  name: string,
  check: (obj: unknown) => obj is T,
): T => {
  if (check(obj)) return obj
  throw new Error(`Not a ${name}`)
}

export const isCID = (obj: unknown): obj is CID => {
  return !!CID.asCID(obj)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}

export const isArray = <T>(
  obj: unknown,
  fn: (i: unknown) => i is T,
): obj is Array<T> => {
  return Array.isArray(obj) && obj.every(fn)
}

export const isString = (obj: unknown): obj is string => {
  return typeof obj === 'string'
}

export const assureString = (obj: unknown): string => {
  return assure(obj, 'String', isString)
}

export const isDID = (obj: unknown): obj is DID => {
  return isString(obj)
}

export const assureDID = (obj: unknown): DID => {
  return assure(obj, 'DID', isDID)
}

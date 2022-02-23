import { CID } from 'multiformats/cid'

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

export const isString = (obj: unknown): obj is string => {
  return typeof obj === 'string'
}

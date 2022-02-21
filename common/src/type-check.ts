import { CID } from 'multiformats/cid'
import { Commit, IdMapping, User } from './types.js'

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

// @TODO: maybe split these out as static methods on their classes?
export const isUser = (obj: unknown): obj is User => {
  return (
    isObject(obj) &&
    typeof obj.name === 'string' &&
    typeof obj.did === 'string' &&
    typeof obj.nextPost === 'number' &&
    !!CID.asCID(obj.postsRoot) &&
    Array.isArray(obj.follows)
  )
}

export const assureUser = (obj: unknown): User => {
  return assure(obj, 'User', isUser)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}

export const isCommit = (obj: unknown): obj is Commit => {
  return isObject(obj) && isCID(obj.user) && ArrayBuffer.isView(obj.sig)
}

export const assureCommit = (obj: unknown): Commit => {
  return assure(obj, 'Commit', isCommit)
}

export const isIdMapping = (obj: unknown): obj is IdMapping => {
  return isObject(obj) && Object.values(obj).every(isCID)
}

export const assureIdMapping = (obj: unknown): IdMapping => {
  return assure(obj, 'IdMapping', isIdMapping)
}

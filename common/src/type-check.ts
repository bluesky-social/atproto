import { CID } from 'multiformats/cid'
import Timestamp from './timestamp.js'
import { Commit, IdMapping, User } from './types.js'

export const assure = <T>(obj: any, name: string, check: (obj: any) => obj is T): T => {
  if(check(obj)) return obj
  throw new Error(`Not a ${name}`)
}

export const isObject = (obj: any): obj is Object => {
  return obj && typeof obj === 'object'
}

export const isCID = (obj: any): obj is CID => {
  return !!CID.asCID(obj)
}

// @TODO: maybe split these out as static methods on their classes?
export const isUser = (obj: any): obj is User => {
  return isObject(obj)
    && typeof obj.name === 'string'
    && typeof obj.did === 'string'
    && typeof obj.nextPost === 'number'
    && !!CID.asCID(obj.postsRoot)
    && Array.isArray(obj.follows)
}

export const assureUser = (obj: any): User => {
  return assure(obj, "User", isUser)
}

export const isCommit = (obj: any): obj is Commit => {
  return isObject(obj)
    && isCID(obj.user)
    && ArrayBuffer.isView(obj.sig)
}

export const assureCommit = (obj: any): Commit => {
  return assure(obj, "Commit", isCommit)
}

export const isIdMapping = (obj: any): obj is IdMapping => {
  return isObject(obj) 
    && Object.values(obj).every(isCID)
}

export const assureIdMapping = (obj: any): IdMapping => {
  return assure(obj, "IdMapping", isIdMapping)
}

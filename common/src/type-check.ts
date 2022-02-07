import { CID } from 'multiformats/cid'
import { SignedRoot, SSTableData, User } from './types.js'

export const isObject = (obj: any): obj is Object => {
  return obj && typeof obj === 'object'
}

export const isCID = (obj: any): obj is CID => {
  return !!CID.asCID(obj)
}

export const isUser = (obj: any): obj is User => {
  return isObject(obj)
    && typeof obj.name === 'string'
    && typeof obj.did === 'string'
    && typeof obj.nextPost === 'number'
    && !!CID.asCID(obj.postsRoot)
    && Array.isArray(obj.follows)
}

export const assureUser = (obj: any): User => {
  if(isUser(obj)) return obj
  throw new Error("Not a user")
}

export const isSignedRoot = (obj: any): obj is SignedRoot => {
  return isObject(obj)
    && isCID(obj.user)
    && ArrayBuffer.isView(obj.sig)
}

export const isSSTableData = (obj: any): obj is SSTableData => {
  return isObject(obj) 
    && Object.values(obj).every(isCID)
}

export const assureSSTableData = (obj: any): SSTableData => {
  if(isSSTableData(obj)) return obj
  throw new Error("Not an SSTable")
}

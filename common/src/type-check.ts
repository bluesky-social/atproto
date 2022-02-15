import { CID } from 'multiformats/cid'
import { Commit, User } from './types.js'

export const isObject = (obj: any): obj is Object => {
  return obj && typeof obj === 'object'
}

export const isUser = (obj: any): obj is User => {
  return isObject(obj)
    && typeof obj.name === 'string'
    && typeof obj.did === 'string'
    && typeof obj.nextPost === 'number'
    && !!CID.asCID(obj.postsRoot)
    && Array.isArray(obj.follows)
}

export const isCommit = (obj: any): obj is Commit => {
  return isObject(obj)
    && !!CID.asCID(obj.user)
    && ArrayBuffer.isView(obj.sig)
}

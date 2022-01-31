import { CID } from 'multiformats/cid'
import { SignedRoot, User } from './types'

export const isObject = (obj: any): obj is Object => {
  return obj && typeof obj === 'object'
}

export const isString = (str: any): str is string => {
  return typeof str === 'string'
}

export const isUsername = (str: any): str is string => {
  return isString(str) && /(.+)@(.+)/.test(str)
}

export const isUser = (obj: any): obj is User => {
  return isObject(obj)
    && isUsername(obj.name)
    && typeof obj.did === 'string'
    && typeof obj.nextPost === 'number'
    && !!CID.asCID(obj.postsRoot)
    && Array.isArray(obj.follows)
}

export const isSignedRoot = (obj: any): obj is SignedRoot => {
  return isObject(obj)
    && !!CID.asCID(obj.user)
    && ArrayBuffer.isView(obj.sig)
}

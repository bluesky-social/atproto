import { isCID, assure, isObject } from '../common/type-check.js'
import { Commit, UserRoot, SchemaRoot, IdMapping } from './types.js'

export const isUserRoot = (obj: unknown): obj is UserRoot => {
  return isObject(obj) && typeof obj.did === 'string'
}

export const assureUserRoot = (obj: unknown): UserRoot => {
  return assure(obj, 'UserRoot', isUserRoot)
}

export const isCommit = (obj: unknown): obj is Commit => {
  return isObject(obj) && isCID(obj.root) && ArrayBuffer.isView(obj.sig)
}

export const assureCommit = (obj: unknown): Commit => {
  return assure(obj, 'Commit', isCommit)
}

export const isSchemaRoot = (obj: unknown): obj is SchemaRoot => {
  return (
    isObject(obj) &&
    isCID(obj.posts) &&
    isCID(obj.relationships) &&
    isCID(obj.interactions) &&
    (obj.profile === null || isCID(obj.profile))
  )
}

export const assureSchemaRoot = (obj: unknown): SchemaRoot => {
  return assure(obj, 'SchemaRoot', isSchemaRoot)
}

export const isIdMapping = (obj: unknown): obj is IdMapping => {
  return isObject(obj) && Object.values(obj).every(isCID)
}

export const assureIdMapping = (obj: unknown): IdMapping => {
  return assure(obj, 'IdMapping', isIdMapping)
}

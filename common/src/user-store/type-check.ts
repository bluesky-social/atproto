import { isCID, assure, isObject } from '../common/type-check.js'
import { Commit, UserRoot, ProgramRoot, IdMapping } from './types.js'

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

export const isProgramRoot = (obj: unknown): obj is ProgramRoot => {
  return (
    isObject(obj) &&
    isCID(obj.posts) &&
    isCID(obj.relationships) &&
    isCID(obj.interactions) &&
    (obj.profile === null || isCID(obj.profile))
  )
}

export const assureProgramRoot = (obj: unknown): ProgramRoot => {
  return assure(obj, 'ProgramRoot', isProgramRoot)
}

export const isIdMapping = (obj: unknown): obj is IdMapping => {
  return isObject(obj) && Object.values(obj).every(isCID)
}

export const assureIdMapping = (obj: unknown): IdMapping => {
  return assure(obj, 'IdMapping', isIdMapping)
}

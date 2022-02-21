import { isCID, assure } from '../../common/types/check'
import { Commit, Root, IdMapping } from './index.js'

export const isRoot = (obj: unknown): obj is Root => {
  return (
    isObject(obj) &&
    typeof obj.did === 'string' &&
    isCID(obj.posts) &&
    isCID(obj.relationships) &&
    isCID(obj.interactions)
  )
}

export const assureRoot = (obj: unknown): Root => {
  return assure(obj, 'Root', isRoot)
}

export const isObject = (obj: unknown): obj is Record<string, unknown> => {
  return typeof obj === 'object' && obj !== null
}

export const isCommit = (obj: unknown): obj is Commit => {
  return isObject(obj) && isCID(obj.root) && ArrayBuffer.isView(obj.sig)
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

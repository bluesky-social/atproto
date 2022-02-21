import { isCID, assure } from '../../common/types/check'
import { Commit, IdMapping } from './index.js'

// export const isUser = (obj: unknown): obj is User => {
//   return (
//     isObject(obj) &&
//     typeof obj.name === 'string' &&
//     typeof obj.did === 'string' &&
//     typeof obj.nextPost === 'number' &&
//     !!CID.asCID(obj.postsRoot) &&
//     Array.isArray(obj.follows)
//   )
// }

// export const assureUser = (obj: unknown): User => {
//   return assure(obj, 'User', isUser)
// }

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

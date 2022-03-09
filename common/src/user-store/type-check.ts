// import { isCID, assure, isObject, isArray } from '../common/type-check.js'
// import { Commit, UserRoot, ProgramRoot, IdMapping } from './types.js'
import * as t from './types.js'

export * from '../common/type-check.js'

export const isUserRoot = (obj: unknown): obj is t.UserRoot => {
  return t.userRoot.safeParse(obj).success
}

export const assureUserRoot = (obj: unknown): t.UserRoot => {
  return t.userRoot.parse(obj)
}

export const isCommit = (obj: unknown): obj is t.Commit => {
  return t.commit.safeParse(obj).success
}

export const assureCommit = (obj: unknown): t.Commit => {
  return t.commit.parse(obj)
}

export const isProgramRoot = (obj: unknown): obj is t.ProgramRoot => {
  return t.programRoot.safeParse(obj).success
}

export const assureProgramRoot = (obj: unknown): t.ProgramRoot => {
  return t.programRoot.parse(obj)
}

export const isIdMapping = (obj: unknown): obj is t.IdMapping => {
  return t.idMapping.safeParse(obj).success
}

export const assureIdMapping = (obj: unknown): t.IdMapping => {
  return t.idMapping.parse(obj)
}

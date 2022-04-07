import { CID } from 'multiformats'
import { IdMapping } from '../repo/types.js'
import CidSet from './cid-set.js'
import TID from './tid.js'

type Delete = {
  key: string
}

type Add = {
  key: string
  cid: CID
}

type Update = {
  key: string
  old: CID
  cid: CID
}

type Diff = {
  adds: Add[]
  updates: Update[]
  deletes: Delete[]
}

export const idMapDiff = (
  mapA: IdMapping,
  mapB: IdMapping,
  newCids: CidSet,
): Diff => {
  const diff: Diff = {
    adds: [],
    updates: [],
    deletes: [],
  }
  // find deletions
  for (const key of Object.keys(mapA)) {
    if (!mapB[key]) {
      diff.deletes.push({ key })
    }
  }
  // find additions & changes
  for (const key of Object.keys(mapB)) {
    const old = mapA[key]
    const cid = mapB[key]
    if (!newCids.has(cid)) {
      throw new Error(`Cid not included in added cids: ${cid.toString()}`)
    }
    if (old !== cid) {
      if (old) {
        diff.adds.push({ key, cid })
      } else {
        diff.updates.push({ key, old, cid })
      }
    }
  }
  return diff
}

export enum EventType {
  AddedPost = 'added_post',
  UpdatedPost = 'updated_post',
  DeletedPost = 'deleted_post',
  AddedInteraction = 'added_interaction',
  UpdatedInteraction = 'updated_interaction',
  DeletedInteraction = 'deleted_interaction',
  DeletedProgram = 'deleted_program',
  DeletedCollection = 'deleted_collection',
  DeletedTable = 'deleted_table',
}

export type Event =
  | AddedPost
  | UpdatedPost
  | DeletedPost
  | AddedInteraction
  | UpdatedInteraction
  | DeletedInteraction
  | DeletedProgram
  | DeletedCollection
  | DeletedTable

export type AddedPost = {
  event: EventType.AddedPost
  tid: TID
  cid: CID
}
export type UpdatedPost = { event: EventType.UpdatedPost }
export type DeletedPost = { event: EventType.DeletedPost }

export type AddedInteraction = {
  event: EventType.AddedInteraction
  tid: TID
  cid: CID
}
export type UpdatedInteraction = { event: EventType.UpdatedInteraction }
export type DeletedInteraction = { event: EventType.DeletedInteraction }

export type DeletedProgram = {
  event: EventType.DeletedProgram
  name: string
}
export type DeletedCollection = { event: EventType.DeletedCollection }
export type DeletedTable = { event: EventType.DeletedTable }

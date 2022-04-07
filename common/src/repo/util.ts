import { CID } from 'multiformats'
import { Collection, Entry, IdMapping } from '../repo/types.js'
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

export const entriesDiff = (
  entriesA: Entry[],
  entriesB: Entry[],
  newCids: CidSet,
): Diff => {
  const idMapA = entriesToIdMapping(entriesA)
  const idMapB = entriesToIdMapping(entriesB)
  return idMapDiff(idMapA, idMapB, newCids)
}

export const entriesToIdMapping = (entries: Entry[]): IdMapping => {
  return entries.reduce((acc, cur) => {
    acc[cur.tid.toString()] = cur.cid
    return acc
  }, {} as IdMapping)
}

export enum EventType {
  AddedObject = 'added_object',
  UpdatedObject = 'updated_object',
  DeletedObject = 'deleted_object',
  DeletedNamespace = 'deleted_namespace',
  DeletedCollection = 'deleted_collection',
  DeletedTable = 'deleted_table',
}

export type Event =
  | AddedObject
  | UpdatedObject
  | DeletedObject
  | DeletedNamespace
  | DeletedCollection

export type AddedObject = {
  event: EventType.AddedObject
  namespace: string
  collection: Collection
  tid: TID
  cid: CID
}

export type UpdatedObject = {
  event: EventType.UpdatedObject
  namespace: string
  collection: Collection
  tid: TID
  cid: CID
  prevCid: CID
}

export type DeletedObject = {
  event: EventType.DeletedObject
  namespace: string
  collection: Collection
  tid: TID
}

export type DeletedNamespace = {
  event: EventType.DeletedNamespace
  name: string
}

export type DeletedCollection = { event: EventType.DeletedCollection }

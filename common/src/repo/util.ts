import { CID } from 'multiformats'
import { Collection, TIDEntry, DIDEntry, IdMapping } from '../repo/types.js'
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
  prevMap: IdMapping,
  currMap: IdMapping,
  newCids: CidSet,
): Diff => {
  const diff: Diff = {
    adds: [],
    updates: [],
    deletes: [],
  }
  // find deletions
  for (const key of Object.keys(prevMap)) {
    if (!currMap[key]) {
      diff.deletes.push({ key })
    }
  }
  // find additions & changes
  for (const key of Object.keys(currMap)) {
    const old = prevMap[key]
    const cid = currMap[key]
    if (old && old.equals(cid)) continue
    if (!newCids.has(cid)) {
      throw new Error(`Cid not included in added cids: ${cid.toString()}`)
    }
    if (old) {
      diff.updates.push({ key, old, cid })
    } else {
      diff.adds.push({ key, cid })
    }
  }
  return diff
}

export const tidEntriesDiff = (
  prevEntries: TIDEntry[],
  currEntries: TIDEntry[],
  newCids: CidSet,
): Diff => {
  const idPrevMap = tidEntriesToIdMapping(prevEntries)
  const idCurrMap = tidEntriesToIdMapping(currEntries)
  return idMapDiff(idPrevMap, idCurrMap, newCids)
}

export const tidEntriesToIdMapping = (entries: TIDEntry[]): IdMapping => {
  return entries.reduce((acc, cur) => {
    acc[cur.tid.toString()] = cur.cid
    return acc
  }, {} as IdMapping)
}

export const didEntriesDiff = (
  prevEntries: DIDEntry[],
  currEntries: DIDEntry[],
  newCids: CidSet,
): Diff => {
  const idPrevMap = didEntriesToIdMapping(prevEntries)
  const idCurrMap = didEntriesToIdMapping(currEntries)
  return idMapDiff(idPrevMap, idCurrMap, newCids)
}

export const didEntriesToIdMapping = (entries: DIDEntry[]): IdMapping => {
  return entries.reduce((acc, cur) => {
    acc[cur.did] = cur.cid
    return acc
  }, {} as IdMapping)
}

export enum EventType {
  AddedObject = 'added_object',
  UpdatedObject = 'updated_object',
  DeletedObject = 'deleted_object',
  AddedRelationship = 'added_relationship',
  UpdatedRelationship = 'updated_relationship',
  DeletedRelationship = 'deleted_relationship',
  DeletedNamespace = 'deleted_namespace',
  DeletedCollection = 'deleted_collection',
  DeletedTable = 'deleted_table',
}

export type Event =
  | AddedObject
  | UpdatedObject
  | DeletedObject
  | AddedRelationship
  | UpdatedRelationship
  | DeletedRelationship
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

export type AddedRelationship = {
  event: EventType.AddedRelationship
  did: string
  cid: CID
}

export type UpdatedRelationship = {
  event: EventType.UpdatedRelationship
  did: string
  cid: CID
  prevCid: CID
}

export type DeletedRelationship = {
  event: EventType.DeletedRelationship
  did: string
}

export type DeletedNamespace = {
  event: EventType.DeletedNamespace
  name: string
}

export type DeletedCollection = { event: EventType.DeletedCollection }

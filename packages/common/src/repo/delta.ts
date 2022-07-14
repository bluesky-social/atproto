import { CID } from 'multiformats'
import { Collection, TIDEntry, DIDEntry, IdMapping } from '../repo/types'
import CidSet from './cid-set'
import TID from './tid'
import * as auth from '@adxp/auth'

// AUTHORIZATION HELPERS
// ----------------------

export const capabilityForEvent = (
  did: string,
  event: Event,
): auth.ucans.Capability => {
  if (isRelationshipEvent(event)) {
    return auth.writeCap(did, 'relationships')
  }
  if (isObjectEvent(event)) {
    return auth.writeCap(
      did,
      event.namespace,
      event.collection,
      event.tid.toString(),
    )
  }
  if (isNamespaceEvent(event)) {
    return auth.writeCap(did, event.namespace)
  }
  throw new Error(`Could not identity event: ${event}`)
}

// DELTA TYPES & HELPERS
// ----------------------

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

// EVENT TYPES & HELPERS
// ----------------------

export enum EventType {
  AddedRelationship = 'added_relationship',
  UpdatedRelationship = 'updated_relationship',
  DeletedRelationship = 'deleted_relationship',
  AddedObject = 'added_object',
  UpdatedObject = 'updated_object',
  DeletedObject = 'deleted_object',
  DeletedNamespace = 'deleted_namespace',
}

export type RelationshipEvent =
  | AddedRelationship
  | UpdatedRelationship
  | DeletedRelationship

export type ObjectEvent = AddedObject | UpdatedObject | DeletedObject

export type NamespaceEvent = DeletedNamespace

export type Event = RelationshipEvent | ObjectEvent | NamespaceEvent

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
  namespace: string
}

export const addedObject = (
  namespace: string,
  collection: Collection,
  tid: TID,
  cid: CID,
): AddedObject => ({
  event: EventType.AddedObject,
  namespace,
  collection,
  tid,
  cid,
})

export const updatedObject = (
  namespace: string,
  collection: Collection,
  tid: TID,
  cid: CID,
  prevCid: CID,
): UpdatedObject => ({
  event: EventType.UpdatedObject,
  namespace,
  collection,
  tid,
  cid,
  prevCid,
})

export const deletedObject = (
  namespace: string,
  collection: Collection,
  tid: TID,
): DeletedObject => ({
  event: EventType.DeletedObject,
  namespace,
  collection,
  tid,
})

export const addedRelationship = (
  did: string,
  cid: CID,
): AddedRelationship => ({
  event: EventType.AddedRelationship,
  did,
  cid,
})

export const updatedRelationship = (
  did: string,
  cid: CID,
  prevCid: CID,
): UpdatedRelationship => ({
  event: EventType.UpdatedRelationship,
  did,
  cid,
  prevCid,
})

export const deletedRelationship = (did: string): DeletedRelationship => ({
  event: EventType.DeletedRelationship,
  did,
})

export const deletedNamespace = (namespace: string): DeletedNamespace => ({
  event: EventType.DeletedNamespace,
  namespace,
})

export const isRelationshipEvent = (
  event: Event,
): event is RelationshipEvent => {
  return (
    event.event === EventType.AddedRelationship ||
    event.event === EventType.UpdatedRelationship ||
    event.event === EventType.DeletedRelationship
  )
}

export const isObjectEvent = (event: Event): event is ObjectEvent => {
  return (
    event.event === EventType.AddedObject ||
    event.event === EventType.UpdatedObject ||
    event.event === EventType.DeletedObject ||
    event.event === EventType.DeletedNamespace
  )
}

export const isNamespaceEvent = (event: Event): event is NamespaceEvent => {
  return event.event === EventType.DeletedNamespace
}

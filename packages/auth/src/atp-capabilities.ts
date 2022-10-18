import { atpCapability, parseAtpResource } from './atp-semantics'
import * as ucan from '@ucans/core'

export const writeCap = (
  did: string,
  collection?: string,
  record?: string,
): ucan.Capability => {
  let resource = did
  if (collection) {
    resource += '/' + collection
  }
  if (record) {
    resource += '/' + record
  }
  return atpCapability(resource, 'WRITE')
}

export const maintenanceCap = (did: string): ucan.Capability => {
  return atpCapability(did, 'MAINTENANCE')
}

export const vaguerCap = (cap: ucan.Capability): ucan.Capability | null => {
  const rsc = parseAtpResource(cap.with)
  if (rsc === null) return null
  // can't go vaguer than every collection
  if (rsc.collection === '*') return null
  if (rsc.record === '*') return writeCap(rsc.did)
  return writeCap(rsc.did, rsc.collection)
}

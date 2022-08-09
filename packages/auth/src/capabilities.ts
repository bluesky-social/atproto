import { adxCapability, parseAdxResource } from './semantics'
import * as ucan from './ucans/index'

export const writeCap = (
  did: string,
  namespace?: string,
  collection?: string,
  record?: string,
): ucan.Capability => {
  let resource = did
  if (namespace) {
    resource += '/' + namespace
  }
  if (collection) {
    resource += '/' + collection
  }
  if (record) {
    resource += '/' + record
  } else {
    resource += '/*'
  }
  return adxCapability(resource, 'WRITE')
}

export const maintenanceCap = (did: string): ucan.Capability => {
  const resource = `${did}/*`
  return adxCapability(resource, 'MAINTENANCE')
}

export const vaguerCap = (cap: ucan.Capability): ucan.Capability | null => {
  const rsc = parseAdxResource(cap.with)
  if (rsc === null) return null
  // can't go vaguer than every namespace
  if (rsc.namespace === '*') return null
  if (rsc.collection === '*') return writeCap(rsc.did)
  if (rsc.record === '*') return writeCap(rsc.did, rsc.namespace)
  return writeCap(rsc.did, rsc.namespace, rsc.collection)
}

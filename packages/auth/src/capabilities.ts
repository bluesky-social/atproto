import { adxCapability, parseAdxResource } from './semantics'
import * as ucan from './ucans/index'

export const writeCap = (
  did: string,
  namespace?: string,
  dataset?: string,
  record?: string,
): ucan.Capability => {
  let resource = did
  if (namespace) {
    resource += '/' + namespace
  }
  if (dataset) {
    resource += '/' + dataset
  }
  if (record) {
    resource += '/' + record
  }
  return adxCapability(resource, 'WRITE')
}

export const maintenanceCap = (did: string): ucan.Capability => {
  return adxCapability(did, 'MAINTENANCE')
}

export const vaguerCap = (cap: ucan.Capability): ucan.Capability | null => {
  const rsc = parseAdxResource(cap.with)
  if (rsc === null) return null
  // can't go vaguer than every namespace
  if (rsc.namespace === '*') return null
  if (rsc.dataset === '*') return writeCap(rsc.did)
  if (rsc.record === '*') return writeCap(rsc.did, rsc.namespace)
  return writeCap(rsc.did, rsc.namespace, rsc.dataset)
}

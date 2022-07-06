import { adxCapability } from './semantics'
import * as ucan from './ucans/index'

export const writeCap = (
  did: string,
  collection?: string,
  schema?: string,
  record?: string,
): ucan.Capability => {
  let resource = did
  if (collection) {
    resource += '|' + collection
  }
  if (schema) {
    resource += '|' + schema
  }
  if (record) {
    resource += '|' + record
  } else {
    resource += '|*'
  }
  return adxCapability(resource, 'WRITE')
}

export const maintenanceCap = (did: string): ucan.Capability => {
  const resource = `${did}|*`
  return adxCapability(resource, 'MAINTENANCE')
}

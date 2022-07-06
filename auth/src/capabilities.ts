import { adxCapability } from './semantics.js'
import * as ucan from './ucans/index.js'

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

// export const hasPermission = (
//   parent: AdxCapability,
//   child: AdxCapability,
// ): boolean => {
//   const attempt = adxSemantics.tryDelegating(parent, child)
//   return attempt !== null && !isCapabilityEscalation(attempt)
// }

// export const collectionEscalation = (cap: AdxCapability) => {
//   return {
//     escalation: 'ADX collection escalation',
//     capability: cap,
//   }
// }

// export const schemaEscalation = (cap: AdxCapability) => {
//   return {
//     escalation: 'ADX schema escalation',
//     capability: cap,
//   }
// }

// export const recordEscalation = (cap: AdxCapability) => {
//   return {
//     escalation: 'ADX record escalation',
//     capability: cap,
//   }
// }

// export function adxCapabilities(ucan: Chained) {
//   return capabilities(ucan, adxSemantics)
// }

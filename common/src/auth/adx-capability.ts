import {
  capabilities,
  Capability,
  CapabilitySemantics,
  CapabilityEscalation,
  Chained,
  isCapabilityEscalation,
} from 'ucans'
import TID from '../repo/tid'
import { Collection } from '../repo/types'

/*
ADX Ucans:

Resource name: 'adx'

- Full permission for account: 
    did:example:userDid|*
- Permission to write to particular namespace: 
    did:example:userDid|did:example:microblog|*
- Permission to make only interactions in a given namespace:
    did:example:userDid|did:example:microblog|interactions|*
- Permission to create a single interaction on user's behalf: 
    did:example:userDid|did:example:microblog|interactions|234567abcdefg

Example: 
{
  adx: 'did:example:abcdefg|did:example:microblog|*'
  cap: 'WRITE'
}

At the moment, for demonstration purposes, we support only two capability level: 
- 'WRITE': this allows full create/update/delete permissions for the given resource
- 'MAINTENANCE': this does not allow updates to repo objects, but allows maintenance of the repo, such as repo creation
*/

export const AdxAbilityLevels = {
  MAINTENANCE: 0,
  WRITE: 1,
}
export type AdxAbility = keyof typeof AdxAbilityLevels

export const isAdxAbility = (ability: string): ability is AdxAbility => {
  return ability === 'MAINTENANCE' || ability === 'WRITE'
}

export interface AdxCapability extends Capability {
  adx: string
  cap: AdxAbility
}

export const adxSemantics: CapabilitySemantics<AdxCapability> = {
  tryParsing(cap: Capability): AdxCapability | null {
    if (typeof cap.adx === 'string' && isAdxAbility(cap.cap)) {
      return {
        adx: cap.adx,
        cap: cap.cap,
      }
    }
    return null
  },

  tryDelegating(
    parentCap: AdxCapability,
    childCap: AdxCapability,
  ): AdxCapability | null | CapabilityEscalation<AdxCapability> {
    if (AdxAbilityLevels[childCap.cap] > AdxAbilityLevels[parentCap.cap]) {
      return {
        escalation: 'Capability level escalation',
        capability: childCap,
      }
    }

    const [childDid, childNamespace, childCollection, childTid] =
      childCap.adx.split('|')
    const [parentDid, parentNamespace, parentCollection, parentTid] =
      parentCap.adx.split('|')

    if (childDid !== parentDid) {
      return null
    }

    if (parentNamespace === '*') {
      return childCap
    } else if (childNamespace === '*') {
      return namespaceEscalation(childCap)
    } else if (childNamespace !== parentNamespace) {
      return null
    }

    if (parentCollection === '*') {
      return childCap
    } else if (childCollection === '*') {
      return namespaceEscalation(childCap)
    } else if (childCollection !== parentCollection) {
      return null
    }

    if (parentTid === '*') {
      return childCap
    } else if (childTid === '*') {
      return namespaceEscalation(childCap)
    } else if (childTid !== parentTid) {
      return null
    }
    // they totally match
    return childCap
  },
}

export const hasPermission = (
  parent: AdxCapability,
  child: AdxCapability,
): boolean => {
  const attempt = adxSemantics.tryDelegating(parent, child)
  return attempt !== null && !isCapabilityEscalation(attempt)
}

export const namespaceEscalation = (cap: AdxCapability) => {
  return {
    escalation: 'ADX namespace esclation',
    capability: cap,
  }
}

export const collectionEscalation = (cap: AdxCapability) => {
  return {
    escalation: 'ADX collection esclation',
    capability: cap,
  }
}

export const tidEscalation = (cap: AdxCapability) => {
  return {
    escalation: 'ADX TID esclation',
    capability: cap,
  }
}

export function writeCap(
  did: string,
  namespace?: string,
  collection?: Collection,
  tid?: TID,
): AdxCapability {
  let resource = did
  if (namespace) {
    resource += '|' + namespace
  }
  if (collection) {
    resource += '|' + collection
  }
  if (tid) {
    resource += '|' + tid.toString()
  } else {
    resource += '|*'
  }
  return {
    adx: resource,
    cap: 'WRITE',
  }
}

export function maintenanceCap(did: string): AdxCapability {
  return {
    adx: `${did}|*`,
    cap: 'MAINTENANCE',
  }
}

export function adxCapabilities(ucan: Chained) {
  return capabilities(ucan, adxSemantics)
}

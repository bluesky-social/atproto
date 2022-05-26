import {
  capabilities,
  Capability,
  CapabilitySemantics,
  CapabilityEscalation,
  Chained,
  isCapabilityEscalation,
} from 'ucans'
import { Ability, isAbility } from 'ucans/capability/ability'
import { SUPERUSER } from 'ucans/capability/super-user'

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
  with: { scheme: "adx", hierPart: "did:example:abcdefg|did:example:microblog|*" },
  can: { namespace: "adx", segments: [ "WRITE" ] }
}

At the moment, for demonstration purposes, we support only two capability level: 
- 'WRITE': this allows full create/update/delete permissions for the given resource
- 'MAINTENANCE': this does not allow updates to repo objects, but allows maintenance of the repo, such as repo creation
*/

export const ADX_ABILITY_LEVELS = {
  SUPER_USER: 2,
  WRITE: 1,
  MAINTENANCE: 0,
}

export const ADX_ABILITIES: string[] = Object.keys(ADX_ABILITY_LEVELS)

export type AdxAbility = keyof typeof ADX_ABILITY_LEVELS

export const isAdxCap = (cap: Capability): boolean => {
  return cap.with.scheme === 'adx' && isAdxAbility(cap.can)
}

export const isAdxAbility = (ability: unknown): ability is AdxAbility => {
  if (!isAbility(ability)) return false
  if (ability === SUPERUSER) return true
  const abilitySegment = ability.segments[0]
  const isAdxAbilitySegment =
    !!abilitySegment && ADX_ABILITIES.includes(abilitySegment)
  return isAdxAbilitySegment && ability.namespace.toLowerCase() === 'adx'
}

export function parseAdxAbility(ability: Ability): AdxAbility | null {
  if (ability === SUPERUSER) return 'SUPER_USER'
  if (isAdxAbility(ability)) return ability.segments[0] as AdxAbility
  return null
}

export function adxCapability(
  resource: string,
  ability: AdxAbility,
): Capability {
  return {
    with: { scheme: 'adx', hierPart: resource },
    can: { namespace: 'adx', segments: [ability] },
  }
}

export function writeCap(
  did: string,
  collection?: string,
  tid?: string,
): Capability {
  let resource = did
  if (collection) {
    resource += '|' + collection
  }
  if (tid) {
    resource += '|' + tid.toString()
  } else {
    resource += '|*'
  }
  return adxCapability(resource, 'WRITE')
}

export function maintenanceCap(did: string): Capability {
  const resource = `${did}|*`
  return adxCapability(resource, 'MAINTENANCE')
}

export interface AdxCapability {
  did: string
  collection: string
  record: string
  ability: AdxAbility
}

export const adxSemantics: CapabilitySemantics<AdxCapability> = {
  tryParsing(cap: Capability): AdxCapability | null {
    if (!isAdxCap(cap)) return null
    const ability = parseAdxAbility(cap.can)
    if (!ability) return null

    const parts = cap.with.hierPart.split('|')
    const [did, collection] = parts
    let record = parts[2]
    if (!did) return null
    if (!collection) return null
    if (collection === '*') {
      record = '*'
    }
    if (!record) return null

    return {
      did,
      collection,
      record,
      ability,
    }
  },

  tryDelegating(
    parentCap: AdxCapability,
    childCap: AdxCapability,
  ): AdxCapability | null | CapabilityEscalation<AdxCapability> {
    // need to delegate to the same user's repo
    if (childCap.did !== parentCap.did) return null

    if (
      ADX_ABILITY_LEVELS[childCap.ability] >
      ADX_ABILITY_LEVELS[parentCap.ability]
    ) {
      return {
        escalation: 'Capability level escalation',
        capability: childCap,
      }
    }

    if (parentCap.collection === '*') {
      return childCap
    } else if (childCap.collection === '*') {
      return collectionEscalation(childCap)
    }

    if (parentCap.record === '*') {
      return childCap
    } else if (childCap.record === '*') {
      return recordEscalation(childCap)
    }

    // all good
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

export const collectionEscalation = (cap: AdxCapability) => {
  return {
    escalation: 'ADX collection escalation',
    capability: cap,
  }
}

export const recordEscalation = (cap: AdxCapability) => {
  return {
    escalation: 'ADX record escalation',
    capability: cap,
  }
}

export function adxCapabilities(ucan: Chained) {
  return capabilities(ucan, adxSemantics)
}

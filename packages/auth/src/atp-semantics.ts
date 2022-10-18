import * as ucans from '@ucans/core'

/*
ATP Ucans:

Resource name: 'at'

- Full permission for account: 
    at://did:example:userDid/*
- Permission to write to particular application collection: 
    at://did:example:userDid/com.foo.post/*
- Permission to create a single interaction on user's behalf: 
    at://did:example:userDid/com.foo.post/234567abcdefg

Example: 
{
  with: { scheme: "at", hierPart: "did:example:userDid/com.foo.post/*" },
  can: { namespace: "atp", segments: [ "WRITE" ] }
}

At the moment, we support only two capability level: 
- 'WRITE': this allows full create/update/delete permissions for the given resource
- 'MAINTENANCE': this does not allow updates to repo objects, but allows maintenance of the repo, such as repo creation
*/

export const ATP_ABILITY_LEVELS = {
  SUPER_USER: 2,
  WRITE: 1,
  MAINTENANCE: 0,
}

export const ATP_ABILITIES: string[] = Object.keys(ATP_ABILITY_LEVELS)

export type AtpAbility = keyof typeof ATP_ABILITY_LEVELS

export const isAtpCap = (cap: ucans.Capability): boolean => {
  return cap.with.scheme === 'at' && isAtpAbility(cap.can)
}

export const isAtpAbility = (ability: unknown): ability is AtpAbility => {
  if (!ucans.ability.isAbility(ability)) return false
  if (ability === ucans.ability.SUPERUSER) return true
  const abilitySegment = ability.segments[0]
  const isAtpAbilitySegment =
    !!abilitySegment && ATP_ABILITIES.includes(abilitySegment)
  return isAtpAbilitySegment && ability.namespace.toLowerCase() === 'atp'
}

export const parseAtpAbility = (
  ability: ucans.ability.Ability,
): AtpAbility | null => {
  if (ability === ucans.ability.SUPERUSER) return 'SUPER_USER'
  if (isAtpAbility(ability)) return ability.segments[0] as AtpAbility
  return null
}

export const atpCapability = (
  resource: string,
  ability: AtpAbility,
): ucans.Capability => {
  return {
    with: { scheme: 'at', hierPart: resource },
    can: { namespace: 'atp', segments: [ability] },
  }
}
export interface AtpResourcePointer {
  did: string
  collection: string
  record: string
}

// @TODO: ugly import on param
export const parseAtpResource = (
  pointer: ucans.capability.resourcePointer.ResourcePointer,
): AtpResourcePointer | null => {
  if (pointer.scheme !== 'at') return null

  const parts = pointer.hierPart.split('/')
  let [did, collection, record] = parts
  if (!did) return null
  if (!collection) collection = '*'
  if (!record) record = '*'
  return {
    did,
    collection,
    record,
  }
}

export const atpSemantics: ucans.DelegationSemantics = {
  canDelegateResource(parentResource, childResource) {
    const parent = parseAtpResource(parentResource)
    const child = parseAtpResource(childResource)

    if (parent == null || child == null) return false
    if (parent.did !== child.did) return false

    if (parent.collection === '*') return true
    if (parent.collection !== child.collection) return false

    if (parent.record === '*') return true

    return parent.record === child.record
  },

  canDelegateAbility(parentAbility, childAbility) {
    const parent = parseAtpAbility(parentAbility)
    const child = parseAtpAbility(childAbility)

    if (parent == null || child == null) return false

    if (ATP_ABILITY_LEVELS[child] > ATP_ABILITY_LEVELS[parent]) {
      return false
    }

    return true
  },
}

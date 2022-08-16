import * as ucans from './ucans'

/*
ADX Ucans:

Resource name: 'adx'

- Full permission for account: 
    adx://did:example:userDid/*
- Permission to write to particular application namespace: 
    adx://did:example:userDid/namespace/*
- Permission to write objects within a particular collection (namespace + dataset): 
    adx://did:example:userDid/namespace/post/*
- Permission to create a single interaction on user's behalf: 
    adx://did:example:userDid/namespace/post/234567abcdefg

Example: 
{
  with: { scheme: "adx", hierPart: "did:example:userDid/microblog/*" },
  can: { namespace: "adx", segments: [ "WRITE" ] }
}

At the moment, we support only two capability level: 
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

export const isAdxCap = (cap: ucans.Capability): boolean => {
  return cap.with.scheme === 'adx' && isAdxAbility(cap.can)
}

export const isAdxAbility = (ability: unknown): ability is AdxAbility => {
  if (!ucans.ability.isAbility(ability)) return false
  if (ability === ucans.ability.SUPERUSER) return true
  const abilitySegment = ability.segments[0]
  const isAdxAbilitySegment =
    !!abilitySegment && ADX_ABILITIES.includes(abilitySegment)
  return isAdxAbilitySegment && ability.namespace.toLowerCase() === 'adx'
}

export const parseAdxAbility = (
  ability: ucans.ability.Ability,
): AdxAbility | null => {
  if (ability === ucans.ability.SUPERUSER) return 'SUPER_USER'
  if (isAdxAbility(ability)) return ability.segments[0] as AdxAbility
  return null
}

export const adxCapability = (
  resource: string,
  ability: AdxAbility,
): ucans.Capability => {
  return {
    with: { scheme: 'adx', hierPart: resource },
    can: { namespace: 'adx', segments: [ability] },
  }
}
export interface AdxResourcePointer {
  did: string
  namespace: string
  dataset: string
  record: string
}

// @TODO: ugly import on param
export const parseAdxResource = (
  pointer: ucans.capability.resourcePointer.ResourcePointer,
): AdxResourcePointer | null => {
  if (pointer.scheme !== 'adx') return null

  const parts = pointer.hierPart.split('/')
  let [did, namespace, dataset, record] = parts
  // let [namespace, dataset, record] = parts.slice(1)
  if (!did) return null
  if (!namespace) namespace = '*'
  if (!dataset) dataset = '*'
  if (!record) record = '*'
  return {
    did,
    namespace,
    dataset,
    record,
  }
}

export const adxSemantics: ucans.DelegationSemantics = {
  canDelegateResource(parentResource, childResource) {
    const parent = parseAdxResource(parentResource)
    const child = parseAdxResource(childResource)

    if (parent == null || child == null) return false
    if (parent.did !== child.did) return false

    if (parent.namespace === '*') return true
    if (parent.namespace !== child.namespace) return false

    if (parent.dataset === '*') return true
    if (parent.dataset !== child.dataset) return false

    if (parent.record === '*') return true

    return parent.record === child.record
  },

  canDelegateAbility(parentAbility, childAbility) {
    const parent = parseAdxAbility(parentAbility)
    const child = parseAdxAbility(childAbility)

    if (parent == null || child == null) return false

    if (ADX_ABILITY_LEVELS[child] > ADX_ABILITY_LEVELS[parent]) {
      return false
    }

    return true
  },
}

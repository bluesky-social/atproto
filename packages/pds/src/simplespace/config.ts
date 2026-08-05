import { InvalidRequestError } from '@atproto/xrpc-server'
import { SpaceConfig, SpaceRow } from '../actor-store/space/index.js'
import { com } from '../lexicons/index.js'

const { defs } = com.atproto.simplespace

type LexSpace = com.atproto.simplespace.getSpace.$OutputBody
type LexPolicy = LexSpace['policy']
type LexAppAccess = LexSpace['appAccess']

// Both unions are open, so an unrecognized variant is well-formed on the wire and
// arrives here. Storing it would mean enforcing something the host doesn't implement,
// so it's refused rather than coerced to a default.
export function policyToStorage(policy: LexPolicy): SpaceConfig {
  if (defs.publicPolicy.$isTypeOf(policy)) {
    return { policy: 'public', managingApp: null }
  }
  if (defs.memberListPolicy.$isTypeOf(policy)) {
    return { policy: 'member-list', managingApp: null }
  }
  if (defs.managingAppPolicy.$isTypeOf(policy)) {
    const { managingApp } = policy
    if (!managingApp.startsWith('did:')) {
      throw new InvalidRequestError(
        `managingApp must be a DID with an optional service fragment, got: ${managingApp}`,
        'UnsupportedPolicy',
      )
    }
    return { policy: 'managing-app', managingApp }
  }
  throw new InvalidRequestError(
    `Unsupported policy: ${policy.$type}`,
    'UnsupportedPolicy',
  )
}

export function appAccessToStorage(appAccess: LexAppAccess): SpaceConfig {
  if (defs.open.$isTypeOf(appAccess)) {
    return { appAccessType: 'open', appAllowed: [] }
  }
  if (defs.allowList.$isTypeOf(appAccess)) {
    return { appAccessType: 'allowList', appAllowed: appAccess.allowed }
  }
  throw new InvalidRequestError(
    `Unsupported appAccess: ${appAccess.$type}`,
    'UnsupportedAppAccess',
  )
}

export function toLexConfig(space: SpaceRow): LexSpace {
  return {
    uri: space.uri as LexSpace['uri'],
    policy: policyToLex(space),
    appAccess: appAccessToLex(space),
  }
}

function policyToLex(space: SpaceRow): LexPolicy {
  switch (space.policy) {
    case 'public':
      return defs.publicPolicy.build({})
    case 'managing-app':
      return defs.managingAppPolicy.build({
        managingApp: space.managingApp ?? '',
      })
    default:
      return defs.memberListPolicy.build({})
  }
}

function appAccessToLex(space: SpaceRow): LexAppAccess {
  if (space.appAccessType === 'allowList') {
    return defs.allowList.build({ allowed: space.appAllowed })
  }
  return defs.open.build({})
}

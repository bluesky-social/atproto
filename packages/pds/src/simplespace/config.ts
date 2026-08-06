import { InvalidRequestError } from '@atproto/xrpc-server'
import { SimplespaceConfig } from '../actor-store/db/index.js'
import { SpaceAppAccess, SpacePolicy } from '../actor-store/space/reader.js'
import { com } from '../lexicons/index.js'

const { defs } = com.atproto.simplespace

type LexSpace = com.atproto.simplespace.getSpace.$OutputBody
type LexPolicy = LexSpace['policy']
type LexAppAccess = LexSpace['appAccess']

export function lexPolicyToDb(policy: LexPolicy): SpacePolicy {
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

export function lexAppAccessToDb(appAccess: LexAppAccess): SpaceAppAccess {
  if (defs.open.$isTypeOf(appAccess)) {
    return { appAccessType: 'open', appAllowed: JSON.stringify([]) }
  }
  if (defs.allowList.$isTypeOf(appAccess)) {
    return {
      appAccessType: 'allowList',
      appAllowed: JSON.stringify(appAccess.allowed),
    }
  }
  throw new InvalidRequestError(
    `Unsupported appAccess: ${appAccess.$type}`,
    'UnsupportedAppAccess',
  )
}

export function toLexConfig(config: SimplespaceConfig): LexSpace {
  return {
    uri: config.uri as LexSpace['uri'],
    policy: policyToLex(config),
    appAccess: appAccessToLex(config),
  }
}

function policyToLex(config: SpacePolicy): LexPolicy {
  switch (config.policy) {
    case 'public':
      return defs.publicPolicy.build({})
    case 'managing-app':
      return defs.managingAppPolicy.build({
        managingApp: config.managingApp ?? '',
      })
    default:
      return defs.memberListPolicy.build({})
  }
}

function appAccessToLex(config: SpaceAppAccess): LexAppAccess {
  if (config.appAccessType === 'allowList') {
    return defs.allowList.build({ allowed: JSON.parse(config.appAllowed) })
  }
  return defs.open.build({})
}

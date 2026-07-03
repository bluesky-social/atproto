import { SpaceConfig as StorageConfig } from '../../../../actor-store/space/transactor.js'
import { com } from '../../../../lexicons/index.js'

type LexAppAccess = com.atproto.simplespace.defs.SpaceConfig['appAccess']

// Build the lexicon `appAccess` union from the stored (type, allowed) pair.
export function toLexAppAccess(
  appAccessType: string,
  appAllowed: string[],
): LexAppAccess {
  if (appAccessType === 'allowList') {
    return com.atproto.simplespace.defs.allowList.build({ allowed: appAllowed })
  }
  return com.atproto.simplespace.defs.open.build({})
}

// Reduce the lexicon `appAccess` union to the stored (type, allowed) pair.
export function fromLexAppAccess(appAccess: LexAppAccess): {
  appAccessType: string
  appAllowed: string[]
} {
  if (
    appAccess.$type === 'com.atproto.simplespace.defs#allowList' &&
    'allowed' in appAccess &&
    Array.isArray(appAccess.allowed)
  ) {
    return {
      appAccessType: 'allowList',
      appAllowed: appAccess.allowed,
    }
  }
  return { appAccessType: 'open', appAllowed: [] }
}

// Build the full lexicon spaceConfig from a stored space row. Return type is
// inferred from `.build()` so it carries a definite `$type` (the handler output
// union requires it).
export function toLexSpaceConfig(row: {
  policy: string
  managingApp: string | null
  appAccessType: string
  appAllowed: string[]
}) {
  return com.atproto.simplespace.defs.spaceConfig.build({
    policy: row.policy as com.atproto.simplespace.defs.SpaceConfig['policy'],
    appAccess: toLexAppAccess(row.appAccessType, row.appAllowed),
    managingApp: row.managingApp ?? undefined,
  })
}

export type { StorageConfig }

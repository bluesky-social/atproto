export * from './atproto-oauth-scope.js'

export * from './scope-missing-error.js'
export * from './scope-permissions-transition.js'
export * from './scope-permissions.js'
export * from './scopes-set.js'

export * from './scopes/account-permission.js'
export * from './scopes/blob-permission.js'
export * from './scopes/identity-permission.js'
export * from './scopes/include-scope.js'
export * from './scopes/repo-permission.js'
export * from './scopes/rpc-permission.js'
export * from './scopes/space-permission.js'

// Re-export of legacy types
export {
  /** @deprecated use `NsidString` */
  type NsidString as Nsid,
  /** @deprecated use `isNsidString` */
  isValidNsid as isNsid,
} from '@atproto/syntax'

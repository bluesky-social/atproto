import { AccountScope } from './resources/account-scope.js'
import { BlobScope } from './resources/blob-scope.js'
import { IdentityScope } from './resources/identity-scope.js'
import { RepoScope } from './resources/repo-scope.js'
import { RpcScope } from './resources/rpc-scope.js'
import { ResourceSyntax } from './syntax.js'

export function isValidAtprotoOauthScope(value: string) {
  if (value === 'atproto') return true
  if (value === 'transition:email') return true
  if (value === 'transition:generic') return true
  if (value === 'transition:chat.bsky') return true

  const syntax = ResourceSyntax.fromString(value)
  if (syntax.resource === 'repo') {
    return RepoScope.fromSyntax(syntax) != null
  } else if (syntax.resource === 'rpc') {
    return RpcScope.fromSyntax(syntax) != null
  } else if (syntax.resource === 'account') {
    return AccountScope.fromSyntax(syntax) != null
  } else if (syntax.resource === 'identity') {
    return IdentityScope.fromSyntax(syntax) != null
  } else if (syntax.resource === 'blob') {
    return BlobScope.fromSyntax(syntax) != null
  }

  return false
}

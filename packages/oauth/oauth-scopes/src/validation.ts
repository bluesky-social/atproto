import { AccountScope } from './resources/account-scope.js'
import { BlobScope } from './resources/blob-scope.js'
import { IdentityScope } from './resources/identity-scope.js'
import { RepoScope } from './resources/repo-scope.js'
import { RpcScope } from './resources/rpc-scope.js'
import { ParsedResourceScope } from './syntax.js'

export function isValidAtprotoOauthScope(value: string) {
  if (value === 'atproto') return true
  if (value === 'transition:email') return true
  if (value === 'transition:generic') return true
  if (value === 'transition:chat.bsky') return true

  const parsed = ParsedResourceScope.fromString(value)
  if (parsed.resource === 'repo') {
    return RepoScope.fromParsed(parsed) != null
  } else if (parsed.resource === 'rpc') {
    return RpcScope.fromParsed(parsed) != null
  } else if (parsed.resource === 'account') {
    return AccountScope.fromParsed(parsed) != null
  } else if (parsed.resource === 'identity') {
    return IdentityScope.fromParsed(parsed) != null
  } else if (parsed.resource === 'blob') {
    return BlobScope.fromParsed(parsed) != null
  }

  return false
}

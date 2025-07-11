import { AccountScope } from '../permissions/resources/account-scope'
import { BlobScope } from '../permissions/resources/blob-scope'
import { IdentityScope } from '../permissions/resources/identity-scope'
import { RepoScope } from '../permissions/resources/repo-scope'
import { RpcScope } from '../permissions/resources/rpc-scope'
import { ParsedResourceScope } from '../permissions/scope-syntax'

export function isValidPermission(value: string) {
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

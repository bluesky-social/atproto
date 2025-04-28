import { OAuthScope } from '@atproto/oauth-provider'

export function validateScope(scope?: OAuthScope): boolean {
  return scope == null || scope.split(' ').every(isKnownScope)
}

function isKnownScope(value) {
  return (
    value === 'atproto' ||
    value === 'transition:email' ||
    value === 'transition:generic' ||
    value === 'transition:chat.bsky'
  )
}

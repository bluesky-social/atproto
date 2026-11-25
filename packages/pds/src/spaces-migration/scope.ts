import { SpacePermission } from '@atproto/oauth-scopes'

/**
 * Whether an OAuth token's scope grants access to spaces. The scope has its
 * `include:` permission sets expanded, so a set granting space access counts.
 */
export type GrantsSpaceAccess = (scope: string) => boolean

// `transition:generic` grants no space access, so only `space:` permissions count
export const grantsSpaceAccess: GrantsSpaceAccess = (scope) =>
  scope.split(' ').some((s) => SpacePermission.fromString(s) !== null)

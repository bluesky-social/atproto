/**
 * Whether an OAuth token's scope grants access to spaces. The scope has its
 * `include:` permission sets expanded, so a set granting space access counts.
 */
export type GrantsSpaceAccess = (scope: string) => boolean

// Until spaces are served no scope grants access to them
export const neverGrantsSpaceAccess: GrantsSpaceAccess = () => false

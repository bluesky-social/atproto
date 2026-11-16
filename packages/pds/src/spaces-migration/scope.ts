/** Whether an OAuth scope asks for access to spaces. */
export type GrantsSpaceAccess = (scope: string) => boolean

// Until spaces are served no scope grants access to them
export const neverGrantsSpaceAccess: GrantsSpaceAccess = () => false

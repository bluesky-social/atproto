// @TODO (?) use NSID from @atproto/syntax

export type NSIDLike = `${string}.${string}`
export const isNSIDLike = (value: string): value is NSIDLike =>
  value.includes('.') &&
  !value.includes(' ') &&
  !value.startsWith('.') &&
  !value.endsWith('.')

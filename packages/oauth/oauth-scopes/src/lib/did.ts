export type DIDLike = `did:${string}`
export const isDIDLike = (value: string): value is DIDLike =>
  value.startsWith('did:')

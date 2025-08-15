// @TODO (?) use isDid from @atproto/did

export type DIDLike = `did:${string}`
export const isDIDLike = (value: string): value is DIDLike =>
  value.startsWith('did:')

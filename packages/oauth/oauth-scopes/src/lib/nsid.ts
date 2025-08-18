import { isValidNsid } from '@atproto/syntax'

export type Nsid = `${string}.${string}.${string}`
export const isNsid = (v: string): v is Nsid => isValidNsid(v)

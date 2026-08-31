import { type NsidString, isValidNsid } from '@atproto/syntax'

export type Nsid = NsidString
export const isNsid = (v: unknown): v is Nsid =>
  typeof v === 'string' && isValidNsid(v)

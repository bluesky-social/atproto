import { ensureValidDid } from '@atproto/syntax'

export function isValidDid(did: string) {
  try {
    ensureValidDid(did)
    return true
  } catch {
    return false
  }
}

import { ensureValidDid } from '@atproto/syntax'

// @TODO use "Did" from '@atproto/did' package when that package removes its
// dependency on "zod".

export type Did = `did:${string}:${string}`

export function isDid(input: unknown): input is Did {
  try {
    ensureValidDid(input as string)
    return true
  } catch {
    return false
  }
}

export function asDid<T extends string>(input: T): T & Did {
  ensureValidDid(input)
  return input as T & Did
}

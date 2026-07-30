import { Cid } from '@atproto/lex-data'
import { RecordPath } from './types.js'

export const formatRecordPath = (collection: string, rkey: string): string =>
  `${collection}/${rkey}`

export const parseRecordPath = (path: string): RecordPath => {
  const slash = path.indexOf('/')
  if (slash < 1 || slash === path.length - 1) {
    throw new Error(`Invalid record path: ${path}`)
  }
  const collection = path.slice(0, slash)
  const rkey = path.slice(slash + 1)
  if (rkey.includes('/')) {
    throw new Error(`Invalid record path: ${path}`)
  }
  return { collection, rkey }
}

export const formatSetHashElement = (
  collection: string,
  rkey: string,
  cid: Cid,
): string => `${collection}/${rkey}/${cid.toString()}`

export const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

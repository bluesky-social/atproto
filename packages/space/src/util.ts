import type { Cid } from '@atproto/lex-data'
import type { RecordPath } from './types.js'

export const formatRecordPath = (collection: string, rkey: string): string => {
  return collection + '/' + rkey
}

export const parseRecordPath = (path: string): RecordPath => {
  const { length, 0: collection, 1: rkey } = path.split('/')
  if (length !== 2) throw new Error(`invalid record path: ${path}`)
  return { collection, rkey }
}

// The element a record contributes to a repo's set hash.
export const formatSetHashElement = (
  collection: string,
  rkey: string,
  cid: Cid,
): string => {
  return `${collection}/${rkey}/${cid.toString()}`
}

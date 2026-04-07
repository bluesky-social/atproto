import { cidForLex } from '@atproto/lex-cbor'
import { RepoRecord } from './types'

export const formatDataKey = (collection: string, rkey: string): string => {
  return collection + '/' + rkey
}

export const parseDataKey = (
  key: string,
): { collection: string; rkey: string } => {
  const { length, 0: collection, 1: rkey } = key.split('/')
  if (length !== 2) throw new Error(`Invalid record key: ${key}`)
  return { collection, rkey }
}

export const formatRecordElement = async (
  collection: string,
  rkey: string,
  record: RepoRecord,
): Promise<string> => {
  const cid = await cidForLex(record)
  return `${formatDataKey(collection, rkey)}:${cid.toString()}`
}

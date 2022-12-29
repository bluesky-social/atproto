import { check, ipldBytesToValue } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { ReadableBlockstore } from './types'

export const verifyObj = async <T>(
  storage: ReadableBlockstore,
  cid: CID,
  schema: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = await storage.getBytes(cid)
  if (!bytes) {
    throw new Error(`Not found: ${cid.toString()}`)
  }
  const obj = await ipldBytesToValue(bytes)
  if (!check.is(obj, schema)) {
    throw new Error(`Did not find expected object at ${cid.toString()}`)
  }
  return { obj, bytes }
}

export const readObject = async <T>(
  storage: ReadableBlockstore,
  cid: CID,
  schema: check.Def<T>,
): Promise<T> => {
  const obj = await verifyObj(storage, cid, schema)
  return obj.obj
}

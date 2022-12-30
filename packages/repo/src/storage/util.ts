import { check, ipldBytesToValue } from '@atproto/common'
import { CID } from 'multiformats/cid'
import { MissingBlockError, UnexpectedObjectError } from './error'
import { ReadableBlockstore } from './types'

export const verifyObj = async <T>(
  storage: ReadableBlockstore,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = await storage.getBytes(cid)
  if (!bytes) {
    throw new MissingBlockError(cid, def)
  }
  const obj = await ipldBytesToValue(bytes)
  const res = def.schema.safeParse(obj)
  if (res.success) {
    return { obj: res.data, bytes }
  } else {
    throw new UnexpectedObjectError(cid, def)
  }
}

export const readObj = async <T>(
  storage: ReadableBlockstore,
  cid: CID,
  schema: check.Def<T>,
): Promise<T> => {
  const obj = await verifyObj(storage, cid, schema)
  return obj.obj
}

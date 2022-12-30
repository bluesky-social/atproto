import { check, ipldBytesToValue } from '@atproto/common'
import { CID } from 'multiformats/cid'
import BlockMap from '../block-map'
import { MissingBlockError, UnexpectedObjectError } from './error'
import { ReadableBlockstore } from './types'

export const readAndVerify = async <T>(
  storage: ReadableBlockstore,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = await storage.getBytes(cid)
  return verifyObj(bytes, cid, def)
}

export const getAndVerify = async <T>(
  blocks: BlockMap,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = blocks.get(cid) || null
  return verifyObj(bytes, cid, def)
}

export const verifyObj = async <T>(
  bytes: Uint8Array | null,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
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
  const obj = await readAndVerify(storage, cid, schema)
  return obj.obj
}

import { check, cborDecode } from '@atproto/common'
import { CID } from 'multiformats/cid'
import BlockMap from './block-map'
import { MissingBlockError, UnexpectedObjectError } from './error'

export const getAndParse = async <T>(
  blocks: BlockMap,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = blocks.get(cid)
  if (!bytes) {
    throw new MissingBlockError(cid, def)
  }
  return parseObj(bytes, cid, def)
}

export const parseObj = <T>(
  bytes: Uint8Array,
  cid: CID,
  def: check.Def<T>,
): { obj: T; bytes: Uint8Array } => {
  const obj = cborDecode(bytes)
  const res = def.schema.safeParse(obj)
  if (res.success) {
    return { obj: res.data, bytes }
  } else {
    throw new UnexpectedObjectError(cid, def)
  }
}

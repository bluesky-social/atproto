import { check, cborDecode } from '@atproto/common'
import { RepoRecord } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import BlockMap from './block-map'
import { MissingBlockError, UnexpectedObjectError } from './error'
import { cborToLexRecord } from './util'

export const getAndParseRecord = async (
  blocks: BlockMap,
  cid: CID,
): Promise<{ record: RepoRecord; bytes: Uint8Array }> => {
  const bytes = blocks.get(cid)
  if (!bytes) {
    throw new MissingBlockError(cid, 'record')
  }
  const record = await cborToLexRecord(bytes)
  return { record, bytes }
}

export const getAndParseByDef = async <T>(
  blocks: BlockMap,
  cid: CID,
  def: check.Def<T>,
): Promise<{ obj: T; bytes: Uint8Array }> => {
  const bytes = blocks.get(cid)
  if (!bytes) {
    throw new MissingBlockError(cid, def.name)
  }
  return parseObjByDef(bytes, cid, def)
}

export const parseObjByDef = <T>(
  bytes: Uint8Array,
  cid: CID,
  def: check.Def<T>,
): { obj: T; bytes: Uint8Array } => {
  const obj = cborDecode(bytes)
  const res = def.schema.safeParse(obj)
  if (res.success) {
    return { obj: res.data, bytes }
  } else {
    throw new UnexpectedObjectError(cid, def.name)
  }
}

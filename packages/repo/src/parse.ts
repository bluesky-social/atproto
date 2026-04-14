import { check } from '@atproto/common-web'
import { decode } from '@atproto/lex-cbor'
import { Cid, LexMap } from '@atproto/lex-data'
import { BlockMap } from './block-map'
import { MissingBlockError, UnexpectedObjectError } from './error'
import { cborToLexRecord } from './util'

export const getAndParseRecord = async (
  blocks: BlockMap,
  cid: Cid,
): Promise<{ record: LexMap; bytes: Uint8Array }> => {
  const bytes = blocks.get(cid)
  if (!bytes) {
    throw new MissingBlockError(cid, 'record')
  }
  const record = cborToLexRecord(bytes)
  return { record, bytes }
}

export const getAndParseByDef = async <T>(
  blocks: BlockMap,
  cid: Cid,
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
  cid: Cid,
  def: check.Def<T>,
): { obj: T; bytes: Uint8Array } => {
  const obj = decode(bytes)
  const res = def.schema.safeParse(obj)
  if (res.success) {
    return { obj: res.data, bytes }
  } else {
    throw new UnexpectedObjectError(cid, def.name)
  }
}

import { type Cid, type LexValue, encode } from '@atproto/lex-cbor'
import { cidForCbor } from '@atproto/lex-data'

export type { Cid }

export type CarBlock = {
  cid: Cid
  bytes: Uint8Array
}

export async function buildCarBlock(data: LexValue): Promise<CarBlock> {
  const bytes = encode(data)
  const cid = await cidForCbor(bytes)
  return { cid, bytes }
}

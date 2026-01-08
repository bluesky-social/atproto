import { CborCid, LexValue, cidForCbor } from '@atproto/lex-data'
import { encode } from './encoding.js'

export type { Cid } from '@atproto/lex-data'
export type { CborCid, LexValue }

export { decode, decodeAll, encode } from './encoding.js'

export {
  decode as cborDecode,
  decodeAll as cborDecodeAll,
  encode as cborEncode,
} from './encoding.js'

export async function cidForLex(value: LexValue): Promise<CborCid> {
  return cidForCbor(encode(value))
}

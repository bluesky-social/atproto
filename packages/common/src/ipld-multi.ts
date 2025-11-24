import { decodeAll } from '@atproto/lex-cbor'
import { LexValue } from '@atproto/lex-data'

/**
 * @deprecated Use {@link decodeAll} from `@atproto/lex-cbor` instead.
 */
export function cborDecodeMulti(encoded: Uint8Array): LexValue[] {
  return Array.from(decodeAll(encoded))
}

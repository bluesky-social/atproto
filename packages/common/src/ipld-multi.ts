import { cborDecodeAll } from '@atproto/lex-cbor'
import { Lex } from '@atproto/lex-data'

/**
 * @deprecated Use {@link cborDecodeAll} from '@atproto/lex-cbor' instead.
 */
export function cborDecodeMulti(encoded: Uint8Array): Lex[] {
  return Array.from(cborDecodeAll(encoded))
}

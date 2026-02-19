import { CborCid, LexValue, cidForCbor } from '@atproto/lex-data'
import { encode } from './encoding.js'

export type { Cid } from '@atproto/lex-data'
export type { CborCid, LexValue }

export { decode, decodeAll, encode } from './encoding.js'

export {
  decode as cborDecode,
  decodeAll as cborDecodeAll,
  decodeOptions,
  encode as cborEncode,
  encodeOptions,
} from './encoding.js'

/**
 * Computes a CID (Content Identifier) for a given LexValue.
 *
 * This function first encodes the value to CBOR bytes using the AT Protocol
 * data model constraints, then computes the CID hash of those bytes. The
 * resulting CID can be used to uniquely identify and reference the content.
 *
 * @param value - The LexValue to compute a CID for
 * @returns A promise that resolves to the CID for the CBOR-encoded value
 *
 * @example
 * ```typescript
 * import { cidForLex } from '@atproto/lex-cbor'
 *
 * const record = {
 *   $type: 'app.bsky.feed.post',
 *   text: 'Hello, AT Protocol!',
 *   createdAt: new Date().toISOString(),
 * }
 *
 * const cid = await cidForLex(record)
 * console.log(cid.toString()) // e.g., 'bafyreih...'
 * ```
 */
export async function cidForLex(value: LexValue): Promise<CborCid> {
  return cidForCbor(encode(value))
}

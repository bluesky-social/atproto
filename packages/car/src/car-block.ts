import { encode } from '@atproto/lex-cbor'
import {
  type CborCid,
  type Cid,
  type LexValue,
  cidForCbor,
} from '@atproto/lex-data'

// @NOTE cid in car files should always be CborCid. However, for legacy reasons,
// this has been typed as broader Cid. We make this parametrizable to allow for
// more specific typing in places where we parse and generate cids.

// @TODO refactor this package, and all dependents, to use CborCid instead of
// Cid for CarBlock.

export type { CborCid, Cid }

export type CarBlock<TCid extends Cid = Cid> = {
  cid: TCid
  bytes: Uint8Array
}

export async function buildCarBlock(
  data: LexValue,
): Promise<CarBlock<CborCid>> {
  const bytes = encode(data)
  const cid = await cidForCbor(bytes)
  return { cid, bytes }
}

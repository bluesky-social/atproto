import { encode } from '@atproto/lex-cbor'
import {
  type CborCid,
  type Cid,
  type LexValue,
  cidForCbor,
  ui8Equals,
} from '@atproto/lex-data'
import type { CarBlock } from './car-block.js'

// @TODO replace "Cid" with "CborCid" in the type below, and refactor all
// dependents to use CborCid instead of Cid for CarBlock.

export type BlockMapEntry<TCid extends Cid = Cid> = [
  cid: TCid,
  bytes: Uint8Array,
]

/**
 * In memory map for storing data (CBOR or raw bytes) indexed by their CIDs
 * (Content Identifiers).
 */
export class BlockMap<TCid extends Cid = Cid> implements Iterable<
  CarBlock<TCid>
> {
  readonly #map: Map<string, Readonly<CarBlock<TCid>>>

  constructor(blocks?: Iterable<Readonly<CarBlock<TCid>>>) {
    if (blocks instanceof BlockMap) {
      this.#map = new Map(blocks.#map)
    } else {
      this.#map = new Map()
      if (blocks) for (const { cid, bytes } of blocks) this.set(cid, bytes)
    }
  }

  async add(
    // @NOTE Only allow use of add() when CborCid is assignable to TCid. This is
    // expressed through a function-typed property (checked contravariantly)
    // rather than a conditional on TCid, which would make BlockMap invariant.
    this: { set: (cid: CborCid, bytes: Uint8Array) => unknown },
    value: LexValue,
  ): Promise<CborCid> {
    const bytes = encode(value)
    const cid = await cidForCbor(bytes)
    this.set(cid, bytes)
    return cid
  }

  set(cid: TCid, bytes: Uint8Array): this {
    this.#map.set(cid.toString(), { cid, bytes })
    return this
  }

  // @NOTE Read paths below don't require a strong type for the cid, allowing
  // for easier interop with older code that uses Cid instead of CborCid.

  get(cid: Cid): Uint8Array | undefined {
    return this.#map.get(cid.toString())?.bytes
  }

  delete(cid: Cid): this {
    this.#map.delete(cid.toString())
    return this
  }

  getMany<const TInputCid extends Cid>(
    cids: Iterable<TInputCid>,
  ): { blocks: BlockMap<TCid>; missing: TInputCid[] } {
    const missing: TInputCid[] = []
    const blocks = new BlockMap<TCid>()
    for (const cid of cids) {
      const cidStr = cid.toString()
      const entry = this.#map.get(cidStr)
      if (entry) {
        blocks.#map.set(cidStr, entry)
      } else {
        missing.push(cid)
      }
    }
    return { blocks, missing }
  }

  has(cid: Cid): boolean {
    return this.#map.has(cid.toString())
  }

  clear(): void {
    this.#map.clear()
  }

  cids(): TCid[] {
    return Array.from(this.keys())
  }

  addEntries(entries: Iterable<Readonly<BlockMapEntry<TCid>>>): this {
    for (const [cid, bytes] of entries) this.set(cid, bytes)
    return this
  }

  addBlocks(blocks: Iterable<Readonly<CarBlock<TCid>>>): this {
    if (blocks instanceof BlockMap) {
      // Optimization: because BlockMap values are readonly, we can directly
      // copy them into the internal map without creating new objects.
      for (const [cidStr, entry] of blocks.#map.entries()) {
        this.#map.set(cidStr, entry)
      }
    } else {
      for (const { cid, bytes } of blocks) this.set(cid, bytes)
    }
    return this
  }

  get size(): number {
    return this.#map.size
  }

  get byteSize(): number {
    let size = 0
    for (const { bytes } of this.#map.values()) size += bytes.length
    return size
  }

  equals(other: BlockMap): boolean {
    if (this.size !== other.size) {
      return false
    }
    for (const { cid, bytes } of this.#map.values()) {
      const otherBytes = other.get(cid)
      if (!otherBytes) return false
      if (!ui8Equals(bytes, otherBytes)) {
        return false
      }
    }
    return true
  }

  *keys(): Generator<TCid, void, unknown> {
    for (const { cid } of this.#map.values()) yield cid
  }

  *values(): Generator<Uint8Array, void, unknown> {
    for (const { bytes } of this.#map.values()) yield bytes
  }

  *entries(): Generator<BlockMapEntry<TCid>, void, unknown> {
    for (const { cid, bytes } of this.#map.values()) yield [cid, bytes]
  }

  *[Symbol.iterator](): Generator<CarBlock<TCid>, void, unknown> {
    // @NOTE we don't expose the internal Map's values directly, we yield new
    // objects instead. This prevents external code from mutating the internal
    // state of the BlockMap.
    for (const { cid, bytes } of this.#map.values()) yield { cid, bytes }
  }

  static async from<TCid extends Cid>(
    input:
      | Iterable<Readonly<CarBlock<TCid>>>
      | AsyncIterable<Readonly<CarBlock<TCid>>>,
  ): Promise<BlockMap<TCid>> {
    // Optimization: if the input is already a BlockMap, create a new BlockMap
    // from it directly.
    if (input instanceof BlockMap) return new BlockMap(input)

    const blockMap = new BlockMap<TCid>()
    for await (const { cid, bytes } of input) {
      // @TODO Will silently overwrite existing blocks with the same CID we
      // might want to handle duplicates differently? (typically throwing an
      // error)
      blockMap.set(cid, bytes)
    }
    return blockMap
  }
}

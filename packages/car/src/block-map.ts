import { encode } from '@atproto/lex-cbor'
import {
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

export class BlockMap<TCid extends Cid = Cid> implements Iterable<
  CarBlock<TCid>
> {
  readonly #map: Map<string, CarBlock<TCid>> = new Map()

  constructor(entries?: Iterable<Readonly<BlockMapEntry<TCid>>>) {
    if (entries) {
      for (const [cid, bytes] of entries) {
        this.set(cid, bytes)
      }
    }
  }

  async add(value: LexValue): Promise<Cid> {
    const bytes = encode(value)
    const cid = await cidForCbor(bytes)
    // @ts-expect-error see @TODO above
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

  getMany<TInputCid extends Cid>(
    cids: Iterable<TInputCid>,
  ): { blocks: BlockMap<TCid>; missing: TInputCid[] } {
    const missing: TInputCid[] = []
    const blocks = new BlockMap<TCid>()
    for (const cid of cids) {
      const entry = this.#map.get(cid.toString())
      if (entry) {
        blocks.set(entry.cid, entry.bytes)
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

  /** @deprecated Prefer iterating */
  forEach(cb: (bytes: Uint8Array, cid: TCid) => void): void {
    for (const { cid, bytes } of this) cb(bytes, cid)
  }

  cids(): TCid[] {
    return Array.from(this.keys())
  }

  addEntries(entries: Iterable<Readonly<BlockMapEntry<TCid>>>): this {
    for (const [cid, bytes] of entries) this.set(cid, bytes)
    return this
  }

  addBlocks(blocks: Iterable<Readonly<CarBlock<TCid>>>): this {
    for (const { cid, bytes } of blocks) this.set(cid, bytes)
    return this
  }

  /** @deprecated use {@link addEntries} instead */
  addMany(entries: Iterable<Readonly<BlockMapEntry<TCid>>>): this {
    return this.addEntries(entries)
  }

  /** @deprecated use {@link addBlocks} instead */
  addMap(other: Iterable<Readonly<CarBlock<TCid>>>): this {
    return this.addBlocks(other)
  }

  get size(): number {
    return this.#map.size
  }

  get byteSize(): number {
    let size = 0
    for (const bytes of this.values()) size += bytes.length
    return size
  }

  equals(other: BlockMap): boolean {
    if (this.size !== other.size) {
      return false
    }
    for (const { cid, bytes } of this) {
      const otherBytes = other.get(cid)
      if (!otherBytes) return false
      if (!ui8Equals(bytes, otherBytes)) {
        return false
      }
    }
    return true
  }

  *keys(): Generator<TCid, void, unknown> {
    for (const { cid } of this) yield cid
  }

  *values(): Generator<Uint8Array, void, unknown> {
    for (const { bytes } of this) yield bytes
  }

  *entries(): Generator<BlockMapEntry<TCid>, void, unknown> {
    for (const { cid, bytes } of this) yield [cid, bytes]
  }

  [Symbol.iterator](): MapIterator<CarBlock<TCid>> {
    return this.#map.values()
  }

  static async from<TCid extends Cid = Cid>(
    input:
      | Iterable<Readonly<CarBlock<TCid>>>
      | AsyncIterable<Readonly<CarBlock<TCid>>>,
  ): Promise<BlockMap<TCid>> {
    const blockMap = new BlockMap<TCid>()
    for await (const { cid, bytes } of input) {
      blockMap.set(cid, bytes)
    }
    return blockMap
  }
}

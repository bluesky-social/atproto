import { encode } from '@atproto/lex-cbor'
import {
  type Cid,
  type LexValue,
  cidForCbor,
  ui8Equals,
} from '@atproto/lex-data'
import type { CarBlock } from './car-block.js'

export type BlockMapEntry = [cid: Cid, bytes: Uint8Array]

export class BlockMap implements Iterable<CarBlock> {
  readonly #map: Map<string, CarBlock> = new Map()

  constructor(entries?: Iterable<Readonly<BlockMapEntry>>) {
    if (entries) {
      for (const [cid, bytes] of entries) {
        this.set(cid, bytes)
      }
    }
  }

  async add(value: LexValue): Promise<Cid> {
    const bytes = encode(value)
    const cid = await cidForCbor(bytes)
    this.set(cid, bytes)
    return cid
  }

  set(cid: Cid, bytes: Uint8Array): this {
    this.#map.set(cid.toString(), { cid, bytes })
    return this
  }

  get(cid: Cid): Uint8Array | undefined {
    return this.#map.get(cid.toString())?.bytes
  }

  delete(cid: Cid): this {
    this.#map.delete(cid.toString())
    return this
  }

  getMany(cids: Cid[]): { blocks: BlockMap; missing: Cid[] } {
    const missing: Cid[] = []
    const blocks = new BlockMap()
    for (const cid of cids) {
      const entry = this.#map.get(cid.toString())
      if (entry) {
        blocks.set(cid, entry.bytes)
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

  forEach(cb: (bytes: Uint8Array, cid: Cid) => void): void {
    for (const { cid, bytes } of this) cb(bytes, cid)
  }

  cids(): Cid[] {
    return Array.from(this.keys())
  }

  addEntries(entries: Iterable<Readonly<BlockMapEntry>>): this {
    for (const [cid, bytes] of entries) this.set(cid, bytes)
    return this
  }

  addBlocks(blocks: Iterable<Readonly<CarBlock>>): this {
    for (const { cid, bytes } of blocks) this.set(cid, bytes)
    return this
  }

  /** @deprecated use {@link addEntries} instead */
  addMany(entries: Iterable<Readonly<BlockMapEntry>>): this {
    return this.addEntries(entries)
  }

  /** @deprecated use {@link addBlocks} instead */
  addMap(other: Iterable<Readonly<CarBlock>>): this {
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

  *keys(): Generator<Cid, void, unknown> {
    for (const { cid } of this) yield cid
  }

  *values(): Generator<Uint8Array, void, unknown> {
    for (const { bytes } of this) yield bytes
  }

  *entries(): Generator<BlockMapEntry, void, unknown> {
    for (const { cid, bytes } of this) yield [cid, bytes]
  }

  [Symbol.iterator](): MapIterator<CarBlock> {
    return this.#map.values()
  }

  static async from(
    input: Iterable<Readonly<CarBlock>> | AsyncIterable<Readonly<CarBlock>>,
  ): Promise<BlockMap> {
    const blockMap = new BlockMap()
    for await (const { cid, bytes } of input) {
      blockMap.set(cid, bytes)
    }
    return blockMap
  }
}

import { encode } from '@atproto/lex-cbor'
import {
  type Cid,
  type LexValue,
  cidForCbor,
  ui8Equals,
} from '@atproto/lex-data'
import type { CarBlock } from './car-block.js'

export type BlockMapEntry = [cid: Cid, bytes: Uint8Array]

export class BlockMap implements Iterable<BlockMapEntry> {
  private map: Map<string, CarBlock> = new Map()

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
    this.map.set(cid.toString(), { cid, bytes })
    return this
  }

  get(cid: Cid): Uint8Array | undefined {
    return this.map.get(cid.toString())?.bytes
  }

  delete(cid: Cid): this {
    this.map.delete(cid.toString())
    return this
  }

  getMany(cids: Cid[]): { blocks: BlockMap; missing: Cid[] } {
    const missing: Cid[] = []
    const blocks = new BlockMap()
    for (const cid of cids) {
      const entry = this.map.get(cid.toString())
      if (entry) {
        blocks.set(cid, entry.bytes)
      } else {
        missing.push(cid)
      }
    }
    return { blocks, missing }
  }

  has(cid: Cid): boolean {
    return this.map.has(cid.toString())
  }

  clear(): void {
    this.map.clear()
  }

  forEach(cb: (bytes: Uint8Array, cid: Cid) => void): void {
    for (const [cid, bytes] of this) cb(bytes, cid)
  }

  entries(): Iterable<CarBlock> {
    return this.map.values()
  }

  cids(): Cid[] {
    return Array.from(this.keys())
  }

  addMany(toAdd: Iterable<Readonly<BlockMapEntry>>): this {
    for (const [cid, bytes] of toAdd) this.set(cid, bytes)
    return this
  }

  /** @deprecated use {@link addMany} instead */
  addMap(toAdd: Iterable<Readonly<BlockMapEntry>>): this {
    return this.addMany(toAdd)
  }

  get size(): number {
    return this.map.size
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
    for (const [cid, bytes] of this) {
      const otherBytes = other.get(cid)
      if (!otherBytes) return false
      if (!ui8Equals(bytes, otherBytes)) {
        return false
      }
    }
    return true
  }

  *keys(): Generator<Cid, void, unknown> {
    for (const { cid } of this.map.values()) {
      yield cid
    }
  }

  *values(): Generator<Uint8Array, void, unknown> {
    for (const entry of this.map.values()) {
      yield entry.bytes
    }
  }

  *[Symbol.iterator](): Generator<[Cid, Uint8Array], void, unknown> {
    for (const { cid, bytes } of this.map.values()) {
      yield [cid, bytes]
    }
  }
}

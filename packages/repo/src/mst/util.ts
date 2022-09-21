import * as Block from 'multiformats/block'
import { sha256 as blockHasher } from 'multiformats/hashes/sha2'
import * as blockCodec from '@ipld/dag-cbor'
import { CID } from 'multiformats'
import * as uint8arrays from 'uint8arrays'
import IpldStore from '../blockstore/ipld-store'
import { sha256 } from '@adxp/crypto'
import { MST, Leaf, NodeEntry, NodeData, MstOpts, Fanout } from './mst'
import { cidForData } from '@adxp/common'

type SupportedBases = 'base2' | 'base8' | 'base16' | 'base32' | 'base64'

export const leadingZerosOnHash = async (
  key: string,
  fanout: Fanout,
): Promise<number> => {
  if ([2, 8, 16, 32, 64].indexOf(fanout) < 0) {
    throw new Error(`Not a valid fanout: ${fanout}`)
  }
  const base: SupportedBases = `base${fanout}`
  const zeroChar = uint8arrays.toString(new Uint8Array(1), base)[0]
  const hash = await sha256(key)
  const encoded = uint8arrays.toString(hash, base)
  let count = 0
  for (const char of encoded) {
    if (char === zeroChar) {
      count++
    } else {
      break
    }
  }
  return count
}

export const layerForEntries = async (
  entries: NodeEntry[],
  fanout: Fanout,
): Promise<number | null> => {
  const firstLeaf = entries.find((entry) => entry.isLeaf())
  if (!firstLeaf || firstLeaf.isTree()) return null
  return await leadingZerosOnHash(firstLeaf.key, fanout)
}

export const deserializeNodeData = async (
  blockstore: IpldStore,
  data: NodeData,
  opts?: Partial<MstOpts>,
): Promise<NodeEntry[]> => {
  const { layer, fanout } = opts || {}
  const entries: NodeEntry[] = []
  if (data.l !== null) {
    entries.push(
      await MST.load(blockstore, data.l, {
        layer: layer ? layer - 1 : undefined,
        fanout,
      }),
    )
  }
  let lastKey = ''
  for (const entry of data.e) {
    const key = lastKey.slice(0, entry.p) + entry.k
    entries.push(new Leaf(key, entry.v))
    lastKey = key
    if (entry.t !== null) {
      entries.push(
        await MST.load(blockstore, entry.t, {
          layer: layer ? layer - 1 : undefined,
          fanout,
        }),
      )
    }
  }
  return entries
}

export const serializeNodeData = (entries: NodeEntry[]): NodeData => {
  const data: NodeData = {
    l: null,
    e: [],
  }
  let i = 0
  if (entries[0]?.isTree()) {
    i++
    data.l = entries[0].pointer
  }
  let lastKey = ''
  while (i < entries.length) {
    const leaf = entries[i]
    const next = entries[i + 1]
    if (!leaf.isLeaf()) {
      throw new Error('Not a valid node: two subtrees next to each other')
    }
    i++
    let subtree: CID | null = null
    if (next?.isTree()) {
      subtree = next.pointer
      i++
    }
    const prefixLen = countPrefixLen(lastKey, leaf.key)
    data.e.push({
      p: prefixLen,
      k: leaf.key.slice(prefixLen),
      v: leaf.value,
      t: subtree,
    })

    lastKey = leaf.key
  }
  return data
}

export const countPrefixLen = (a: string, b: string): number => {
  let i
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      break
    }
  }
  return i
}

export const cidForEntries = async (entries: NodeEntry[]): Promise<CID> => {
  const data = serializeNodeData(entries)
  return cidForData(data)
}

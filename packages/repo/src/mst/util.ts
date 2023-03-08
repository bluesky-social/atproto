import { CID } from 'multiformats'
import * as uint8arrays from 'uint8arrays'
import { ReadableBlockstore } from '../storage'
import { sha256 } from '@atproto/crypto'
import { MST, Leaf, NodeEntry, NodeData, MstOpts } from './mst'
import { cidForCbor } from '@atproto/common'

export const leadingZerosOnHash = async (key: string | Uint8Array) => {
  const hash = await sha256(key)
  let leadingZeros = 0
  for (let i = 0; i < hash.length; i++) {
    const byte = hash[i]
    if (byte < 64) leadingZeros++
    if (byte < 16) leadingZeros++
    if (byte < 4) leadingZeros++
    if (byte === 0) {
      leadingZeros++
    } else {
      break
    }
  }
  return leadingZeros
}

export const layerForEntries = async (
  entries: NodeEntry[],
): Promise<number | null> => {
  const firstLeaf = entries.find((entry) => entry.isLeaf())
  if (!firstLeaf || firstLeaf.isTree()) return null
  return await leadingZerosOnHash(firstLeaf.key)
}

export const deserializeNodeData = async (
  storage: ReadableBlockstore,
  data: NodeData,
  opts?: Partial<MstOpts>,
): Promise<NodeEntry[]> => {
  const { layer } = opts || {}
  const entries: NodeEntry[] = []
  if (data.l !== null) {
    entries.push(
      await MST.load(storage, data.l, {
        layer: layer ? layer - 1 : undefined,
      }),
    )
  }
  let lastKey = ''
  for (const entry of data.e) {
    const keyStr = uint8arrays.toString(entry.k, 'ascii')
    const key = lastKey.slice(0, entry.p) + keyStr
    ensureValidMstKey(key)
    entries.push(new Leaf(key, entry.v))
    lastKey = key
    if (entry.t !== null) {
      entries.push(
        await MST.load(storage, entry.t, {
          layer: layer ? layer - 1 : undefined,
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
    ensureValidMstKey(leaf.key)
    const prefixLen = countPrefixLen(lastKey, leaf.key)
    data.e.push({
      p: prefixLen,
      k: uint8arrays.fromString(leaf.key.slice(prefixLen), 'ascii'),
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
  return cidForCbor(data)
}

export const isValidMstKey = (str: string): boolean => {
  const split = str.split('/')
  return (
    str.length <= 256 &&
    split.length === 2 &&
    split[0].length > 0 &&
    split[1].length > 0 &&
    isValidChars(split[0]) &&
    isValidChars(split[1])
  )
}

export const validCharsRegex = /^[a-zA-Z0-9_\-:.]*$/

export const isValidChars = (str: string): boolean => {
  return str.match(validCharsRegex) !== null
}

export const ensureValidMstKey = (str: string) => {
  if (!isValidMstKey(str)) {
    throw new InvalidMstKeyError(str)
  }
}

export class InvalidMstKeyError extends Error {
  constructor(public key: string) {
    super(`Not a valid MST key: ${key}`)
  }
}

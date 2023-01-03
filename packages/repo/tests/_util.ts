import fs from 'fs'
import { CID } from 'multiformats'
import { def, TID, valueToIpldBlock } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { Repo } from '../src/repo'
import { readObj, RepoStorage } from '../src/storage'
import { MST } from '../src/mst'
import { RecordWriteOp, RepoContents, WriteOpAction } from '../src'

type IdMapping = Record<string, CID>

export const randomCid = async (storage?: RepoStorage): Promise<CID> => {
  const block = await valueToIpldBlock({ test: randomStr(50) })
  if (storage) {
    await storage.putBlock(block.cid, block.bytes)
  }
  return block.cid
}

export const generateBulkTids = (count: number): TID[] => {
  const ids: TID[] = []
  for (let i = 0; i < count; i++) {
    ids.push(TID.next())
  }
  return ids
}

export const generateBulkTidMapping = async (
  count: number,
  blockstore?: RepoStorage,
): Promise<IdMapping> => {
  const ids = generateBulkTids(count)
  const obj: IdMapping = {}
  for (const id of ids) {
    obj[id.toString()] = await randomCid(blockstore)
  }
  return obj
}

export const keysFromMapping = (mapping: IdMapping): TID[] => {
  return Object.keys(mapping).map((id) => TID.fromStr(id))
}

export const keysFromMappings = (mappings: IdMapping[]): TID[] => {
  return mappings.map(keysFromMapping).flat()
}

export const randomStr = (len: number): string => {
  let result = ''
  const CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  for (let i = 0; i < len; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return result
}

export const shuffle = <T>(arr: T[]): T[] => {
  const toShuffle = [...arr]
  const shuffled: T[] = []
  while (toShuffle.length > 0) {
    const index = Math.floor(Math.random() * toShuffle.length)
    shuffled.push(toShuffle[index])
    toShuffle.splice(index, 1)
  }
  return shuffled
}

export const generateObject = (): Record<string, string> => {
  return {
    name: randomStr(100),
  }
}

// Mass repo mutations & checking
// -------------------------------

export const testCollections = ['com.example.posts', 'com.example.likes']

export type CollectionData = Record<string, unknown>
export type RepoData = Record<string, CollectionData>

export const fillRepo = async (
  repo: Repo,
  keypair: crypto.Keypair,
  itemsPerCollection: number,
): Promise<{ repo: Repo; data: RepoData }> => {
  const repoData: RepoData = {}
  const writes: RecordWriteOp[] = []
  for (const collName of testCollections) {
    const collData: CollectionData = {}
    for (let i = 0; i < itemsPerCollection; i++) {
      const object = generateObject()
      const rkey = TID.nextStr()
      collData[rkey] = object
      writes.push({
        action: WriteOpAction.Create,
        collection: collName,
        rkey,
        value: object,
      })
    }
    repoData[collName] = collData
  }
  const updated = await repo.applyCommit(writes, keypair)
  return {
    repo: updated,
    data: repoData,
  }
}

export const editRepo = async (
  repo: Repo,
  prevData: RepoData,
  keypair: crypto.Keypair,
  params: {
    adds?: number
    updates?: number
    deletes?: number
  },
): Promise<{ repo: Repo; data: RepoData }> => {
  const { adds = 0, updates = 0, deletes = 0 } = params
  const repoData: RepoData = {}
  for (const collName of testCollections) {
    const collData = prevData[collName]
    const shuffled = shuffle(Object.entries(collData))

    for (let i = 0; i < adds; i++) {
      const object = generateObject()
      const rkey = TID.nextStr()
      collData[rkey] = object
      repo = await repo.applyCommit(
        {
          action: WriteOpAction.Create,
          collection: collName,
          rkey,
          value: object,
        },
        keypair,
      )
    }

    const toUpdate = shuffled.slice(0, updates)
    for (let i = 0; i < toUpdate.length; i++) {
      const object = generateObject()
      const rkey = toUpdate[i][0]
      repo = await repo.applyCommit(
        {
          action: WriteOpAction.Update,
          collection: collName,
          rkey,
          value: object,
        },
        keypair,
      )
      collData[rkey] = object
    }

    const toDelete = shuffled.slice(updates, deletes)
    for (let i = 0; i < toDelete.length; i++) {
      const rkey = toDelete[i][0]
      repo = await repo.applyCommit(
        {
          action: WriteOpAction.Delete,
          collection: collName,
          rkey,
        },
        keypair,
      )
      delete collData[rkey]
    }
    repoData[collName] = collData
  }
  return {
    repo,
    data: repoData,
  }
}

export const verifyRepo = async (repo: Repo, data: RepoData): Promise<void> => {
  for (const collName of Object.keys(data)) {
    const collData = data[collName]
    for (const rkey of Object.keys(collData)) {
      const record = await repo.getRecord(collName, rkey)
      expect(record).toEqual(collData[rkey])
    }
  }
}

export const verifyRepoDiff = async (
  ops: RecordWriteOp[],
  before: RepoData,
  after: RepoData,
): Promise<void> => {
  const getVal = (op: RecordWriteOp, data: RepoData) => {
    return (data[op.collection] || {})[op.rkey]
  }

  for (const op of ops) {
    if (op.action === WriteOpAction.Create) {
      expect(getVal(op, before)).toBeUndefined()
      expect(getVal(op, after)).toEqual(op.value)
    } else if (op.action === WriteOpAction.Update) {
      expect(getVal(op, before)).toBeDefined()
      expect(getVal(op, after)).toEqual(op.value)
    } else if (op.action === WriteOpAction.Delete) {
      expect(getVal(op, before)).toBeDefined()
      expect(getVal(op, after)).toBeUndefined()
    } else {
      throw new Error('unexpected op type')
    }
  }
}

export const verifyRepoCheckout = async (
  checkout: RepoContents,
  storage: RepoStorage,
  data: RepoData,
): Promise<void> => {
  expect(Object.keys(checkout).length).toEqual(Object.keys(data).length)
  for (const coll of Object.keys(checkout)) {
    const checkoutColl = checkout[coll]
    const dataColl = data[coll]
    expect(Object.keys(checkoutColl).length).toEqual(
      Object.keys(dataColl).length,
    )
    for (const rkey of Object.keys(checkoutColl)) {
      const cid = checkoutColl[rkey]
      const obj = await readObj(storage, cid, def.unknown)
      expect(obj).toEqual(dataColl[rkey])
    }
  }
}

export const saveMst = async (storage: RepoStorage, mst: MST): Promise<CID> => {
  const diff = await mst.getUnstoredBlocks()
  await storage.putMany(diff.blocks)
  return diff.root
}

// Logging
// ----------------

export const writeMstLog = async (filename: string, tree: MST) => {
  let log = ''
  for await (const entry of tree.walk()) {
    if (entry.isLeaf()) continue
    const layer = await entry.getLayer()
    log += `Layer ${layer}: ${entry.pointer}\n`
    log += '--------------\n'
    const entries = await entry.getEntries()
    for (const e of entries) {
      if (e.isLeaf()) {
        log += `Key: ${e.key} (${e.value})\n`
      } else {
        log += `Subtree: ${e.pointer}\n`
      }
    }
    log += '\n\n'
  }
  fs.writeFileSync(filename, log)
}

export const saveMstEntries = (filename: string, entries: [string, CID][]) => {
  const writable = entries.map(([key, val]) => [key, val.toString()])
  fs.writeFileSync(filename, JSON.stringify(writable))
}

export const loadMstEntries = (filename: string): [string, CID][] => {
  const contents = fs.readFileSync(filename)
  const parsed = JSON.parse(contents.toString())
  return parsed.map(([key, value]) => [key, CID.parse(value)])
}

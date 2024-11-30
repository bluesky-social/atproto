import fs from 'fs'
import { CID } from 'multiformats'
import { TID, dataToCborBlock } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import { Repo } from '../src/repo'
import { RepoStorage } from '../src/storage'
import { MST } from '../src/mst'
import {
  BlockMap,
  CollectionContents,
  RecordWriteOp,
  RepoContents,
  RecordPath,
  WriteOpAction,
  Commit,
  DataDiff,
  CommitData,
} from '../src'
import { Keypair, randomBytes } from '@atproto/crypto'

type IdMapping = Record<string, CID>

export const randomCid = async (storage?: RepoStorage): Promise<CID> => {
  const block = await dataToCborBlock({ test: randomStr(50) })
  if (storage) {
    // @ts-expect-error FIXME remove this comment (and fix the TS error)
    await storage.putBlock(block.cid, block.bytes)
  }
  return block.cid
}

export const generateBulkDataKeys = async (
  count: number,
  blockstore?: RepoStorage,
): Promise<IdMapping> => {
  const obj: IdMapping = {}
  for (let i = 0; i < count; i++) {
    const key = `com.example.record/${TID.nextStr()}`
    obj[key] = await randomCid(blockstore)
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

export const fillRepo = async (
  repo: Repo,
  keypair: crypto.Keypair,
  itemsPerCollection: number,
): Promise<{ repo: Repo; data: RepoContents }> => {
  const repoData: RepoContents = {}
  const writes: RecordWriteOp[] = []
  for (const collName of testCollections) {
    const collData: CollectionContents = {}
    for (let i = 0; i < itemsPerCollection; i++) {
      const object = generateObject()
      const rkey = TID.nextStr()
      collData[rkey] = object
      writes.push({
        action: WriteOpAction.Create,
        collection: collName,
        rkey,
        record: object,
      })
    }
    repoData[collName] = collData
  }
  const updated = await repo.applyWrites(writes, keypair)
  return {
    repo: updated,
    data: repoData,
  }
}

export const formatEdit = async (
  repo: Repo,
  prevData: RepoContents,
  keypair: crypto.Keypair,
  params: {
    adds?: number
    updates?: number
    deletes?: number
  },
): Promise<{ commit: CommitData; data: RepoContents }> => {
  const { adds = 0, updates = 0, deletes = 0 } = params
  const repoData: RepoContents = {}
  const writes: RecordWriteOp[] = []
  for (const collName of testCollections) {
    const collData = { ...(prevData[collName] ?? {}) }
    const shuffled = shuffle(Object.entries(collData))

    for (let i = 0; i < adds; i++) {
      const object = generateObject()
      const rkey = TID.nextStr()
      collData[rkey] = object
      writes.push({
        action: WriteOpAction.Create,
        collection: collName,
        rkey,
        record: object,
      })
    }

    const toUpdate = shuffled.slice(0, updates)
    for (let i = 0; i < toUpdate.length; i++) {
      const object = generateObject()
      const rkey = toUpdate[i][0]
      collData[rkey] = object
      writes.push({
        action: WriteOpAction.Update,
        collection: collName,
        rkey,
        record: object,
      })
    }

    const toDelete = shuffled.slice(updates, deletes)
    for (let i = 0; i < toDelete.length; i++) {
      const rkey = toDelete[i][0]
      delete collData[rkey]
      writes.push({
        action: WriteOpAction.Delete,
        collection: collName,
        rkey,
      })
    }
    repoData[collName] = collData
  }
  const commit = await repo.formatCommit(writes, keypair)
  return {
    commit,
    data: repoData,
  }
}

export const pathsForOps = (ops: RecordWriteOp[]): RecordPath[] =>
  ops.map((op) => ({ collection: op.collection, rkey: op.rkey }))

export const saveMst = async (storage: RepoStorage, mst: MST): Promise<CID> => {
  const diff = await mst.getUnstoredBlocks()
  // @ts-expect-error FIXME remove this comment (and fix the TS error)
  await storage.putMany(diff.blocks)
  return diff.root
}

// Creating repo
// -------------------
export const addBadCommit = async (
  repo: Repo,
  keypair: Keypair,
): Promise<Repo> => {
  const obj = generateObject()
  const newBlocks = new BlockMap()
  const cid = await newBlocks.add(obj)
  const updatedData = await repo.data.add(`com.example.test/${TID.next()}`, cid)
  const dataCid = await updatedData.getPointer()
  const diff = await DataDiff.of(updatedData, repo.data)
  newBlocks.addMap(diff.newMstBlocks)
  // we generate a bad sig by signing some other data
  const rev = TID.nextStr(repo.commit.rev)
  const commit: Commit = {
    ...repo.commit,
    rev,
    data: dataCid,
    sig: await keypair.sign(randomBytes(256)),
  }
  const commitCid = await newBlocks.add(commit)

  // @ts-expect-error FIXME remove this comment (and fix the TS error)
  await repo.storage.applyCommit({
    cid: commitCid,
    rev,
    prev: repo.cid,
    newBlocks,
    removedCids: diff.removedCids,
  })
  return await Repo.load(repo.storage, commitCid)
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

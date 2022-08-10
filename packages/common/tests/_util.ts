import { CID } from 'multiformats'
import IpldStore from '../src/blockstore/ipld-store'
import TID from '../src/repo/tid'
import { IdMapping } from '../src/repo/types'
import { Repo } from '../src/repo'
import { MemoryBlockstore, MST } from '../src'
import fs from 'fs'

const fakeStore = new MemoryBlockstore()

export const randomCid = async (store: IpldStore = fakeStore): Promise<CID> => {
  const str = randomStr(50)
  return store.put({ test: str })
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
  blockstore: IpldStore = fakeStore,
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
  let toShuffle = [...arr]
  let shuffled: T[] = []
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

export const testCollections = ['bsky/posts', 'bsky/likes']

export type CollectionData = Record<string, unknown>
export type RepoData = Record<string, CollectionData>

export const fillRepo = async (
  repo: Repo,
  itemsPerCollection: number,
): Promise<RepoData> => {
  const repoData: RepoData = {}
  for (const collName of testCollections) {
    const collData: CollectionData = {}
    const coll = await repo.getCollection(collName)
    for (let i = 0; i < itemsPerCollection; i++) {
      const object = generateObject()
      const tid = await coll.createRecord(object)
      collData[tid.toString()] = object
    }
    repoData[collName] = collData
  }
  return repoData
}

export const editRepo = async (
  repo: Repo,
  prevData: RepoData,
  params: {
    adds?: number
    updates?: number
    deletes?: number
  },
): Promise<RepoData> => {
  const { adds = 0, updates = 0, deletes = 0 } = params
  const repoData: RepoData = {}
  for (const collName of testCollections) {
    const collData = prevData[collName]
    const shuffled = shuffle(Object.entries(collData))
    const coll = await repo.getCollection(collName)

    for (let i = 0; i < adds; i++) {
      const object = generateObject()
      const tid = await coll.createRecord(object)
      collData[tid.toString()] = object
    }

    const toUpdate = shuffled.slice(0, updates)
    for (let i = 0; i < toUpdate.length; i++) {
      const object = generateObject()
      const tid = TID.fromStr(toUpdate[i][0])
      await coll.updateRecord(tid, object)
      collData[tid.toString()] = object
    }

    const toDelete = shuffled.slice(updates, deletes)
    for (let i = 0; i < toDelete.length; i++) {
      const tid = TID.fromStr(toDelete[i][0])
      await coll.deleteRecord(tid)
      delete collData[tid.toString()]
    }
    repoData[collName] = collData
  }
  return repoData
}

export const checkRepo = async (repo: Repo, data: RepoData): Promise<void> => {
  for (const collName of Object.keys(data)) {
    const coll = await repo.getCollection(collName)
    const collData = data[collName]
    for (const tid of Object.keys(collData)) {
      const record = await coll.getRecord(TID.fromStr(tid))
      expect(record).toEqual(collData[tid])
    }
  }
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

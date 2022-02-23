import { CID } from 'multiformats'
import IpldStore from '../src/blockstore/ipld-store.js'
import Timestamp from '../src/user-store/timestamp.js'
import { IdMapping } from '../src/user-store/types/index.js'
import SSTable from '../src/user-store/ss-table.js'

const fakeStore = IpldStore.createInMemory()

export const randomCid = async (): Promise<CID> => {
  const content = Math.floor(Math.random() * 1000000)
  return fakeStore.put({ test: content })
}

export const generateBulkTids = (
  count: number,
  startAt?: number,
): Timestamp[] => {
  const ids = []
  const start = startAt || Date.now()
  for (let i = 0; i < count; i++) {
    ids.push(new Timestamp(start - i, 1))
  }
  return ids.reverse()
}

export const generateBulkTidMapping = async (
  count: number,
  startAt?: number,
): Promise<IdMapping> => {
  const ids = generateBulkTids(count, startAt)
  const obj = {} as IdMapping
  for (const id of ids) {
    obj[id.toString()] = await randomCid()
  }
  return obj
}

export const keysFromMapping = (mapping: IdMapping): Timestamp[] => {
  return Object.keys(mapping).map((id) => Timestamp.parse(id))
}

export const keysFromMappings = (mappings: IdMapping[]): Timestamp[] => {
  return mappings.map(keysFromMapping).flat()
}

export const checkInclusionInTable = (
  tids: Timestamp[],
  table: SSTable,
): boolean => {
  return tids.map((tid) => table.hasEntry(tid)).every((has) => has === true)
}

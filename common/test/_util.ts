import { CID } from 'multiformats'
import IpldStore from '../src/blockstore/ipld-store.js'
import TID from '../src/user-store/tid.js'
import { IdMapping } from '../src/user-store/types.js'
import { DID } from '../src/common/types.js'
import SSTable from '../src/user-store/ss-table.js'

const fakeStore = IpldStore.createInMemory()

export const randomCid = async (): Promise<CID> => {
  const content = Math.floor(Math.random() * 1000000)
  return fakeStore.put({ test: content })
}

export const generateBulkTids = (count: number): TID[] => {
  const ids = []
  for (let i = 0; i < count; i++) {
    ids.push(TID.next())
  }
  return ids
}

export const generateBulkTidMapping = async (
  count: number,
): Promise<IdMapping> => {
  const ids = generateBulkTids(count)
  const obj: IdMapping = {}
  for (const id of ids) {
    obj[id.toString()] = await randomCid()
  }
  return obj
}

export const keysFromMapping = (mapping: IdMapping): TID[] => {
  return Object.keys(mapping).map((id) => TID.fromStr(id))
}

export const keysFromMappings = (mappings: IdMapping[]): TID[] => {
  return mappings.map(keysFromMapping).flat()
}

export const checkInclusionInTable = (tids: TID[], table: SSTable): boolean => {
  return tids.map((tid) => table.hasEntry(tid)).every((has) => has === true)
}

export const randomDid = (): DID => {
  let result = ''
  const CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  const LENGTH = 48
  for (let i = 0; i < LENGTH; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return `did:key:${result}`
}

export const generateBulkDids = (count: number): DID[] => {
  const dids = []
  for (let i = 0; i < count; i++) {
    dids.push(randomDid())
  }
  return dids
}

import { CID } from 'multiformats'
import IpldStore from '../src/blockstore/ipld-store.js'
import TID from '../src/user-store/tid.js'
import { IdMapping, schema } from '../src/user-store/types.js'
import { DID } from '../src/common/types.js'
import SSTable from '../src/user-store/ss-table.js'
import UserStore from '../src/user-store/index.js'
import { ExecutionContext } from 'ava'

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

export const randomStr = (len: number): string => {
  let result = ''
  const CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  for (let i = 0; i < len; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return result
}

export const randomDid = (): DID => {
  const result = randomStr(48)
  return `did:key:${result}`
}

export const generateBulkDids = (count: number): DID[] => {
  const dids = []
  for (let i = 0; i < count; i++) {
    dids.push(randomDid())
  }
  return dids
}

type UserStoreData = {
  posts: Record<string, string>
  interactions: Record<string, string>
}

export const fillUserStore = async (
  store: UserStore,
  programName: string,
  postsCount: number,
  interCount: number,
): Promise<UserStoreData> => {
  const data: UserStoreData = {
    posts: {},
    interactions: {},
  }
  await store.runOnProgram(programName, async (program) => {
    for (let i = 0; i < postsCount; i++) {
      const tid = await TID.next()
      const content = randomStr(10)
      const cid = await store.put(content)
      await program.posts.addEntry(tid, cid)
      data.posts[tid.toString()] = content
    }
    for (let i = 0; i < interCount; i++) {
      const tid = await TID.next()
      const content = randomStr(10)
      const cid = await store.put(content)
      await program.interactions.addEntry(tid, cid)
      data.interactions[tid.toString()] = content
    }
  })
  return data
}

export const checkUserStore = async (
  t: ExecutionContext<unknown>,
  store: UserStore,
  programName: string,
  data: UserStoreData,
): Promise<void> => {
  await store.runOnProgram(programName, async (program) => {
    for (const tid of Object.keys(data.posts)) {
      const cid = await program.posts.getEntry(TID.fromStr(tid))
      const actual = cid ? await store.get(cid, schema.string) : null
      t.deepEqual(
        actual,
        data.posts[tid],
        `Matching post content for tid: ${tid}`,
      )
    }
    for (const tid of Object.keys(data.interactions)) {
      const cid = await program.interactions.getEntry(TID.fromStr(tid))
      const actual = cid ? await store.get(cid, schema.string) : null
      t.deepEqual(
        actual,
        data.interactions[tid],
        `Matching post content for tid: ${tid}`,
      )
    }
  })
}

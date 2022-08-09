import { CID } from 'multiformats'
import IpldStore from '../src/blockstore/ipld-store'
import TID from '../src/repo/tid'
import { Follow, IdMapping, schema } from '../src/repo/types'
import { DID } from '../src/common/types'
// import SSTable from '../src/repo/ss-table'
import { Repo } from '../src/repo'
import { MST } from '../src'
import fs from 'fs'

const fakeStore = IpldStore.createInMemory()

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

// export const checkInclusionInTable = (tids: TID[], table: SSTable): boolean => {
//   return tids.map((tid) => table.hasEntry(tid)).every((has) => has === true)
// }

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
  const dids: DID[] = []
  for (let i = 0; i < count; i++) {
    dids.push(randomDid())
  }
  return dids
}

export const randomFollow = (): Follow => {
  return {
    did: randomDid(),
    username: randomStr(8),
  }
}

export const generateBulkFollows = (count: number): Follow[] => {
  const follows: Follow[] = []
  for (let i = 0; i < count; i++) {
    follows.push(randomFollow())
  }
  return follows
}

export type RepoData = {
  posts: Record<string, string>
  interactions: Record<string, string>
  follows: Record<string, Follow>
}

// export const fillRepo = async (
//   repo: Repo,
//   namespaceId: string,
//   postsCount: number,
//   interCount: number,
//   followCount: number,
// ): Promise<RepoData> => {
//   const data: RepoData = {
//     posts: {},
//     interactions: {},
//     follows: {},
//   }
//   await repo.runOnNamespace(namespaceId, async (namespace) => {
//     for (let i = 0; i < postsCount; i++) {
//       const tid = await TID.next()
//       const content = randomStr(10)
//       const cid = await repo.put(content)
//       await namespace.posts.addEntry(tid, cid)
//       data.posts[tid.toString()] = content
//     }
//     for (let i = 0; i < interCount; i++) {
//       const tid = await TID.next()
//       const content = randomStr(10)
//       const cid = await repo.put(content)
//       await namespace.interactions.addEntry(tid, cid)
//       data.interactions[tid.toString()] = content
//     }
//   })
//   for (let i = 0; i < followCount; i++) {
//     const follow = randomFollow()
//     await repo.relationships.follow(follow.did, follow.username)
//     data.follows[follow.did] = follow
//   }
//   return data
// }

// export const checkRepo = async (
//   repo: Repo,
//   namespaceId: string,
//   data: RepoData,
// ): Promise<void> => {
//   await repo.runOnNamespace(namespaceId, async (namespace) => {
//     for (const tid of Object.keys(data.posts)) {
//       const cid = await namespace.posts.getEntry(TID.fromStr(tid))
//       const actual = cid ? await repo.get(cid, schema.string) : null
//       expect(actual).toEqual(data.posts[tid])
//     }
//     for (const tid of Object.keys(data.interactions)) {
//       const cid = await namespace.interactions.getEntry(TID.fromStr(tid))
//       const actual = cid ? await repo.get(cid, schema.string) : null
//       expect(actual).toEqual(data.interactions[tid])
//     }
//   })
//   for (const did of Object.keys(data.follows)) {
//     const actual = await repo.relationships.getFollow(did)
//     expect(actual).toEqual(data.follows[did])
//   }
// }

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

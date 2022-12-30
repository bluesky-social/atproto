import { CID } from 'multiformats/cid'
import { RepoRoot, Commit, def, DataStore, RepoMeta } from './types'
import { ReadableBlockstore, readObj } from './storage'
import { MST } from './mst'
import log from './logger'

type Params = {
  storage: ReadableBlockstore
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID
}

export class ReadableRepo {
  storage: ReadableBlockstore
  data: DataStore
  commit: Commit
  root: RepoRoot
  meta: RepoMeta
  cid: CID

  constructor(params: Params) {
    this.storage = params.storage
    this.data = params.data
    this.commit = params.commit
    this.root = params.root
    this.meta = params.meta
    this.cid = params.cid
  }

  static async load(storage: ReadableBlockstore, commitCid: CID) {
    const commit = await readObj(storage, commitCid, def.commit)
    const root = await readObj(storage, commit.root, def.repoRoot)
    const meta = await readObj(storage, root.meta, def.repoMeta)
    const data = await MST.load(storage, root.data)
    log.info({ did: meta.did }, 'loaded repo for')
    return new ReadableRepo({
      storage,
      data,
      commit,
      root,
      meta,
      cid: commitCid,
    })
  }

  get did(): string {
    return this.meta.did
  }

  async getRecord(collection: string, rkey: string): Promise<unknown | null> {
    const dataKey = collection + '/' + rkey
    const cid = await this.data.get(dataKey)
    if (!cid) return null
    return readObj(this.storage, cid, def.unknown)
  }
}

export default ReadableRepo

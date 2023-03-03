import { CID } from 'multiformats/cid'
import { RepoRoot, Commit, def, DataStore, RepoContents } from './types'
import { ReadableBlockstore } from './storage'
import { MST } from './mst'
import log from './logger'
import * as util from './util'
import * as parse from './parse'
import { MissingBlocksError } from './error'

type Params = {
  storage: ReadableBlockstore
  data: DataStore
  commit: Commit
  root: RepoRoot
  cid: CID
}

export class ReadableRepo {
  storage: ReadableBlockstore
  data: DataStore
  commit: Commit
  root: RepoRoot
  cid: CID

  constructor(params: Params) {
    this.storage = params.storage
    this.data = params.data
    this.commit = params.commit
    this.root = params.root
    this.cid = params.cid
  }

  static async load(storage: ReadableBlockstore, commitCid: CID) {
    const commit = await storage.readObj(commitCid, def.commit)
    const root = await storage.readObj(commit.root, def.repoRoot)
    const data = await MST.load(storage, root.data)
    log.info({ did: root.did }, 'loaded repo for')
    return new ReadableRepo({
      storage,
      data,
      commit,
      root,
      cid: commitCid,
    })
  }

  get did(): string {
    return this.root.did
  }

  get version(): number {
    return this.root.version
  }

  async getRecord(collection: string, rkey: string): Promise<unknown | null> {
    const dataKey = collection + '/' + rkey
    const cid = await this.data.get(dataKey)
    if (!cid) return null
    return this.storage.readObj(cid, def.unknown)
  }

  async getContents(): Promise<RepoContents> {
    const entries = await this.data.list()
    const cids = entries.map((e) => e.value)
    const { blocks, missing } = await this.storage.getBlocks(cids)
    if (missing.length > 0) {
      throw new MissingBlocksError('getContents record', missing)
    }
    const contents: RepoContents = {}
    for (const entry of entries) {
      const { collection, rkey } = util.parseDataKey(entry.key)
      contents[collection] ??= {}
      const parsed = await parse.getAndParse(blocks, entry.value, def.record)
      contents[collection][rkey] = parsed.obj
    }
    return contents
  }
}

export default ReadableRepo

import { CID } from 'multiformats/cid'
import { Commit, def, RepoContents } from './types'
import { ReadableBlockstore } from './storage'
import { MST } from './mst'
import log from './logger'
import * as util from './util'
import * as parse from './parse'
import { MissingBlocksError } from './error'

type Params = {
  storage: ReadableBlockstore
  data: MST
  commit: Commit
  cid: CID
}

export class ReadableRepo {
  storage: ReadableBlockstore
  data: MST
  commit: Commit
  cid: CID

  constructor(params: Params) {
    this.storage = params.storage
    this.data = params.data
    this.commit = params.commit
    this.cid = params.cid
  }

  static async load(storage: ReadableBlockstore, commitCid: CID) {
    const commit = await storage.readObj(commitCid, def.commit)
    const data = await MST.load(storage, commit.data)
    log.info({ did: commit.did }, 'loaded repo for')
    return new ReadableRepo({
      storage,
      data,
      commit,
      cid: commitCid,
    })
  }

  get did(): string {
    return this.commit.did
  }

  get version(): number {
    return this.commit.version
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
      const parsed = await parse.getAndParseRecord(blocks, entry.value)
      contents[collection][rkey] = parsed.record
    }
    return contents
  }
}

export default ReadableRepo

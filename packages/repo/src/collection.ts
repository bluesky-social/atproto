import { TID } from '@adxp/common'
import { NSID } from '@adxp/nsid'
import { CID } from 'multiformats/cid'
import Repo from './repo'
import log from './logger'

export class Collection {
  repo: Repo
  nsid: NSID

  constructor(repo: Repo, nsid: NSID | string) {
    this.repo = repo
    this.nsid = typeof nsid === 'string' ? NSID.parse(nsid) : nsid
  }

  name(): string {
    return this.nsid.toString()
  }

  dataIdForRecord(key: string): string {
    return `${this.name()}/${key}`
  }

  async getRecord(key: string): Promise<unknown | null> {
    const cid = await this.repo.data.get(this.dataIdForRecord(key))
    if (cid === null) return null
    return this.repo.blockstore.getUnchecked(cid)
  }

  async listRecords(
    count?: number,
    after?: string,
    before?: string,
  ): Promise<{ key: string; value: unknown }[]> {
    count = count || Number.MAX_SAFE_INTEGER
    const afterKey = after ? this.dataIdForRecord(after) : this.name()
    const beforeKey = before ? this.dataIdForRecord(before) : this.name() + 'a'
    const vals = await this.repo.data.list(count, afterKey, beforeKey)
    return Promise.all(
      vals.map(async (val) => {
        const parts = val.key.split('/')
        const key = parts[parts.length - 1]
        return {
          key,
          value: await this.repo.blockstore.getUnchecked(val.value),
        }
      }),
    )
  }

  async createRecord(
    record: unknown,
    rkey?: string,
  ): Promise<{ rkey: string; cid: CID }> {
    const recordKey = rkey || TID.nextStr()
    const cid = await this.repo.blockstore.put(record as any)
    await this.repo.safeCommit(async (data) => {
      return data.add(this.dataIdForRecord(recordKey), cid)
    })
    log.info(
      {
        did: this.repo.did(),
        collection: this.name(),
        rkey: recordKey,
      },
      'created record',
    )
    return { rkey: recordKey, cid }
  }

  async updateRecord(rkey: string, record: unknown): Promise<CID> {
    const cid = await this.repo.blockstore.put(record as any)
    await this.repo.safeCommit(async (data) => {
      return data.update(this.dataIdForRecord(rkey), cid)
    })
    log.info(
      {
        did: this.repo.did(),
        collection: this.name(),
        rkey,
      },
      'updated record',
    )
    return cid
  }

  async deleteRecord(rkey: string): Promise<void> {
    await this.repo.safeCommit(async (data) => {
      return data.delete(this.dataIdForRecord(rkey))
    })
    log.info(
      {
        did: this.repo.did(),
        collection: this.name(),
        rkey,
      },
      'deleted record',
    )
  }
}

export default Collection

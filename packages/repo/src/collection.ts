import { TID } from '@adxp/common'
import Repo from './repo'

export class Collection {
  repo: Repo
  namespace: string
  dataset: string

  constructor(repo: Repo, namespace: string, dataset: string) {
    this.repo = repo
    this.namespace = namespace
    this.dataset = dataset
  }

  dataIdForRecord(tid: TID): string {
    return `${this.name()}/${tid.toString()}`
  }

  name(): string {
    return `${this.namespace}/${this.dataset}`
  }

  async getRecord(tid: TID): Promise<unknown | null> {
    const cid = await this.repo.data.get(this.dataIdForRecord(tid))
    if (cid === null) return null
    return this.repo.blockstore.getUnchecked(cid)
  }

  async listRecords(
    count?: number,
    after?: TID,
    before?: TID,
  ): Promise<{ key: TID; value: unknown }[]> {
    count = count || Number.MAX_SAFE_INTEGER
    const afterKey = after ? this.dataIdForRecord(after) : this.name()
    const beforeKey = before ? this.dataIdForRecord(before) : this.name() + 'a'
    const vals = await this.repo.data.list(count, afterKey, beforeKey)
    return Promise.all(
      vals.map(async (val) => {
        const parts = val.key.split('/')
        const tid = TID.fromStr(parts[parts.length - 1])
        return {
          key: tid,
          value: await this.repo.blockstore.getUnchecked(val.value),
        }
      }),
    )
  }

  async createRecord(record: unknown): Promise<TID> {
    const tid = TID.next()
    const cid = await this.repo.blockstore.put(record as any)
    await this.repo.safeCommit(async (data) => {
      return data.add(this.dataIdForRecord(tid), cid)
    })
    return tid
  }

  async updateRecord(tid: TID, record: unknown): Promise<void> {
    const cid = await this.repo.blockstore.put(record as any)
    await this.repo.safeCommit(async (data) => {
      return data.update(this.dataIdForRecord(tid), cid)
    })
  }

  async deleteRecord(tid: TID): Promise<void> {
    await this.repo.safeCommit(async (data) => {
      return data.delete(this.dataIdForRecord(tid))
    })
  }
}

export default Collection

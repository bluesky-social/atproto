import Repo from './repo'
import TID from './tid'

export class Collection {
  repo: Repo
  name: string

  constructor(repo: Repo, name: string) {
    this.repo = repo
    this.name = name
  }

  dataIdForRecord(tid: TID): string {
    return `${this.name}/${tid.toString()}`
  }

  async getRecord(tid: TID): Promise<unknown> {
    const cid = await this.repo.data.get(this.dataIdForRecord(tid))
    if (cid === null) {
      throw new Error(`Could not find record: ${tid.formatted()}`)
    }
    return this.repo.blockstore.getUnchecked(cid)
  }

  async listRecords(count?: number): Promise<unknown[]> {
    const vals = await this.repo.data.listWithPrefix(this.name, count)
    return Promise.all(
      vals.map((val) => this.repo.blockstore.getUnchecked(val.value)),
    )
  }

  async createRecord(record: unknown): Promise<TID> {
    const tid = TID.next()
    const cid = await this.repo.blockstore.put(record as any) // @TODO add a check here

    await this.repo.safeCommit(async (data) => {
      return data.add(this.dataIdForRecord(tid), cid)
    })
    return tid
  }

  async updateRecord(tid: TID, record: unknown): Promise<void> {
    const cid = await this.repo.blockstore.put(record as any) // @TODO add a check ehre
    await this.repo.safeCommit(async (data) => {
      return data.add(this.dataIdForRecord(tid), cid)
    })
  }

  async deleteRecord(tid: TID): Promise<void> {
    await this.repo.safeCommit(async (data) => {
      return data.delete(this.dataIdForRecord(tid))
    })
  }
}

export default Collection

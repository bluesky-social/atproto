import Repo from './repo'
import TID from './tid'

export class Collection {
  repo: Repo
  constructor(repo: Repo) {
    this.repo = repo
  }

  async addRecord(obj: unknown): Promise<TID> {
    const tid = TID.next()
    const cid = await this.repo.blockstore.put(obj)

    this.repo.data.add(tid.toString(), obj)
  }

  async updateRecord(tid: TID, obj: unknown): Promise<void>
  async deleteRecord(tid: TID): Promise<void>
}

export default Collection

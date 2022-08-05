import { AdxRecordValidator, AdxSchemas } from '@adxp/schemas'
import Repo from './repo'
import TID from './tid'

type CollSchema = {}

export class Collection {
  repo: Repo
  name: string
  validator: AdxRecordValidator

  constructor(repo: Repo, name: string, validator: AdxRecordValidator) {
    this.repo = repo
    this.name = name
    this.validator = validator
  }

  matchesSchema(obj: unknown): obj is CollSchema {
    return true
  }

  dataIdForRecord(tid: TID): string {
    return `${this.name}/${tid.toString()}`
  }

  async getRecord(tid: TID): Promise<CollSchema> {
    const cid = await this.repo.data.get(this.dataIdForRecord(tid))
    if (cid === null) {
      throw new Error(`Could not find record: ${tid.formatted()}`)
    }
    const record: any = await this.repo.blockstore.get(cid, {} as any) //fix the schema
    return record
  }

  async getUncheckedRecord(tid: TID): Promise<unknown> {
    const cid = await this.repo.data.get(this.dataIdForRecord(tid))
    if (cid === null) {
      throw new Error(`Could not find record: ${tid.formatted()}`)
    }
    return this.repo.blockstore.getUnchecked(cid)
  }

  async createRecord(
    record: unknown,
    disableSchemaCheck = false,
  ): Promise<TID> {
    if (!disableSchemaCheck && !this.matchesSchema(record)) {
      throw new Error(
        `Record does not match schema for collection: ${this.name}`,
      )
    }
    const tid = TID.next()
    const cid = await this.repo.blockstore.put(record)
    await this.repo.data.add(this.dataIdForRecord(tid), cid)
    return tid
  }

  async updateRecord(
    tid: TID,
    record: unknown,
    disableSchemaCheck = false,
  ): Promise<void> {
    if (!disableSchemaCheck && !this.matchesSchema(record)) {
      throw new Error(
        `Record does not match schema for collection: ${this.name}`,
      )
    }
    const cid = await this.repo.blockstore.put(record)
    await this.repo.data.add(this.dataIdForRecord(tid), cid)
  }

  async deleteRecord(tid: TID): Promise<void> {
    await this.repo.data.delete(this.dataIdForRecord(tid))
  }
}

export default Collection

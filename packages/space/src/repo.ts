import { Keypair } from '@atproto/crypto'
import { createCommit, verifyCommit } from './commit'
import { RecordAlreadyExistsError, RecordNotFoundError } from './error'
import { SetHash } from './set-hash'
import { SpaceStorage } from './storage'
import { RepoRecord, SignedCommit, SpaceContext } from './types'
import { formatRecordElement } from './util'

type Params = {
  storage: SpaceStorage
  did: string
  setHash?: SetHash
}

export class Repo {
  storage: SpaceStorage
  did: string
  setHash: SetHash

  constructor(params: Params) {
    this.storage = params.storage
    this.did = params.did
    this.setHash = params.setHash ?? new SetHash()
  }

  static create(storage: SpaceStorage, did: string): Repo {
    return new Repo({ storage, did })
  }

  static async load(storage: SpaceStorage, did: string): Promise<Repo> {
    const stored = await storage.getSetHash()
    if (stored) {
      return new Repo({ storage, did, setHash: new SetHash(stored) })
    }
    return Repo.recompute(storage, did)
  }

  static async recompute(storage: SpaceStorage, did: string): Promise<Repo> {
    const setHash = new SetHash()
    const collections = await storage.listCollections()
    for (const collection of collections) {
      const records = await storage.listRecords(collection)
      for (const { rkey, record } of records) {
        await setHash.add(await formatRecordElement(collection, rkey, record))
      }
    }
    await storage.putSetHash(setHash.toBytes())
    return new Repo({ storage, did, setHash })
  }

  async getRecord(
    collection: string,
    rkey: string,
  ): Promise<RepoRecord | null> {
    return this.storage.getRecord(collection, rkey)
  }

  async createRecord(
    collection: string,
    rkey: string,
    record: RepoRecord,
  ): Promise<void> {
    const existing = await this.storage.hasRecord(collection, rkey)
    if (existing) {
      throw new RecordAlreadyExistsError(collection, rkey)
    }
    await this.storage.putRecord(collection, rkey, record)
    await this.setHash.add(await formatRecordElement(collection, rkey, record))
    await this.storage.putSetHash(this.setHash.toBytes())
  }

  async updateRecord(
    collection: string,
    rkey: string,
    record: RepoRecord,
  ): Promise<void> {
    const existing = await this.storage.getRecord(collection, rkey)
    if (!existing) {
      throw new RecordNotFoundError(collection, rkey)
    }
    await this.setHash.remove(
      await formatRecordElement(collection, rkey, existing),
    )
    await this.storage.putRecord(collection, rkey, record)
    await this.setHash.add(await formatRecordElement(collection, rkey, record))
    await this.storage.putSetHash(this.setHash.toBytes())
  }

  async deleteRecord(collection: string, rkey: string): Promise<void> {
    const existing = await this.storage.getRecord(collection, rkey)
    if (!existing) {
      throw new RecordNotFoundError(collection, rkey)
    }
    await this.storage.deleteRecord(collection, rkey)
    await this.setHash.remove(
      await formatRecordElement(collection, rkey, existing),
    )
    await this.storage.putSetHash(this.setHash.toBytes())
  }

  async listCollections(): Promise<string[]> {
    return this.storage.listCollections()
  }

  async listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]> {
    return this.storage.listRecords(collection)
  }

  async commit(space: SpaceContext, keypair: Keypair): Promise<SignedCommit> {
    return createCommit(this.setHash, space, keypair)
  }

  verifyCommit(space: SpaceContext, commit: SignedCommit): boolean {
    return verifyCommit(space, commit)
  }
}

export { RecordAlreadyExistsError, RecordNotFoundError } from './error'

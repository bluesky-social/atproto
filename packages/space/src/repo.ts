import { cidForLex } from '@atproto/lex-cbor'
import { Keypair } from '@atproto/crypto'
import { createCommit, verifyCommit } from './commit'
import { RecordAlreadyExistsError, RecordNotFoundError } from './error'
import { SetHash } from './set-hash'
import { SpaceStorage } from './storage'
import {
  CommitData,
  PreparedWrite,
  RepoRecord,
  RecordWriteOp,
  SignedCommit,
  SpaceContext,
  WriteOpAction,
} from './types'
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

  static async loadOrCreate(storage: SpaceStorage, did: string): Promise<Repo> {
    const stored = await storage.getSetHash()
    if (stored) {
      return new Repo({ storage, did, setHash: new SetHash(stored) })
    }
    return new Repo({ storage, did })
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
    return new Repo({ storage, did, setHash })
  }

  async formatCommit(
    writes: RecordWriteOp | RecordWriteOp[],
  ): Promise<CommitData> {
    const ops = Array.isArray(writes) ? writes : [writes]
    const prepared: PreparedWrite[] = []
    const newSetHash = new SetHash(this.setHash.toBytes())

    for (const op of ops) {
      if (op.action === WriteOpAction.Create) {
        const existing = await this.storage.hasRecord(op.collection, op.rkey)
        if (existing) {
          throw new RecordAlreadyExistsError(op.collection, op.rkey)
        }
        const cid = await cidForLex(op.record)
        await newSetHash.add(
          await formatRecordElement(op.collection, op.rkey, op.record),
        )
        prepared.push({
          action: WriteOpAction.Create,
          collection: op.collection,
          rkey: op.rkey,
          record: op.record,
          cid,
        })
      } else if (op.action === WriteOpAction.Update) {
        const existing = await this.storage.getRecord(op.collection, op.rkey)
        if (!existing) {
          throw new RecordNotFoundError(op.collection, op.rkey)
        }
        await newSetHash.remove(
          await formatRecordElement(op.collection, op.rkey, existing),
        )
        const cid = await cidForLex(op.record)
        await newSetHash.add(
          await formatRecordElement(op.collection, op.rkey, op.record),
        )
        prepared.push({
          action: WriteOpAction.Update,
          collection: op.collection,
          rkey: op.rkey,
          record: op.record,
          cid,
        })
      } else if (op.action === WriteOpAction.Delete) {
        const existing = await this.storage.getRecord(op.collection, op.rkey)
        if (!existing) {
          throw new RecordNotFoundError(op.collection, op.rkey)
        }
        await newSetHash.remove(
          await formatRecordElement(op.collection, op.rkey, existing),
        )
        prepared.push({
          action: WriteOpAction.Delete,
          collection: op.collection,
          rkey: op.rkey,
        })
      }
    }

    return {
      writes: prepared,
      setHash: newSetHash.toBytes(),
    }
  }

  async applyCommit(commit: CommitData): Promise<void> {
    await this.storage.applyCommit(commit)
    this.setHash = new SetHash(commit.setHash)
  }

  async applyWrites(
    writes: RecordWriteOp | RecordWriteOp[],
  ): Promise<CommitData> {
    const commit = await this.formatCommit(writes)
    await this.applyCommit(commit)
    return commit
  }

  // Reads

  async getRecord(
    collection: string,
    rkey: string,
  ): Promise<RepoRecord | null> {
    return this.storage.getRecord(collection, rkey)
  }

  async listCollections(): Promise<string[]> {
    return this.storage.listCollections()
  }

  async listRecords(
    collection: string,
  ): Promise<{ rkey: string; record: RepoRecord }[]> {
    return this.storage.listRecords(collection)
  }

  // Signed commits

  async commit(space: SpaceContext, keypair: Keypair): Promise<SignedCommit> {
    return createCommit(this.setHash, space, keypair)
  }

  verifyCommit(space: SpaceContext, commit: SignedCommit): boolean {
    return (
      this.setHash.equals(new SetHash(commit.hash)) &&
      verifyCommit(space, commit)
    )
  }
}

export { RecordAlreadyExistsError, RecordNotFoundError } from './error'

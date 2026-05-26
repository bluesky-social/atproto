import { Keypair } from '@atproto/crypto'
import { cidForLex } from '@atproto/lex-cbor'
import { createCommit, verifyCommit } from './commit.js'
import { RecordAlreadyExistsError, RecordNotFoundError } from './error.js'
import { LtHash } from './lthash.js'
import { SpaceRepoStorage } from './storage/index.js'
import {
  CommitData,
  PreparedWrite,
  RecordWriteOp,
  RepoRecord,
  SignedCommit,
  SpaceContext,
  WriteOpAction,
} from './types.js'
import { formatRecordElement } from './util.js'

type Params = {
  storage: SpaceRepoStorage
  did: string
  setHash?: LtHash
}

export class SpaceRepo {
  storage: SpaceRepoStorage
  did: string
  setHash: LtHash

  constructor(params: Params) {
    this.storage = params.storage
    this.did = params.did
    this.setHash = params.setHash ?? new LtHash()
  }

  static create(storage: SpaceRepoStorage, did: string): SpaceRepo {
    return new SpaceRepo({ storage, did })
  }

  static async load(
    storage: SpaceRepoStorage,
    did: string,
  ): Promise<SpaceRepo> {
    const stored = await storage.getSetHashState()
    if (stored) {
      return new SpaceRepo({ storage, did, setHash: new LtHash(stored) })
    }
    return SpaceRepo.recompute(storage, did)
  }

  static async loadOrCreate(
    storage: SpaceRepoStorage,
    did: string,
  ): Promise<SpaceRepo> {
    const stored = await storage.getSetHashState()
    if (stored) {
      return new SpaceRepo({ storage, did, setHash: new LtHash(stored) })
    }
    return new SpaceRepo({ storage, did })
  }

  static async recompute(
    storage: SpaceRepoStorage,
    did: string,
  ): Promise<SpaceRepo> {
    const setHash = new LtHash()
    const collections = await storage.listCollections()
    for (const collection of collections) {
      const records = await storage.listRecords(collection)
      for (const { rkey, record } of records) {
        setHash.add(await formatRecordElement(collection, rkey, record))
      }
    }
    return new SpaceRepo({ storage, did, setHash })
  }

  async formatCommit(
    writes: RecordWriteOp | RecordWriteOp[],
  ): Promise<CommitData> {
    const ops = Array.isArray(writes) ? writes : [writes]
    const prepared: PreparedWrite[] = []
    const newSetHash = new LtHash(this.setHash.toBytes())

    for (const op of ops) {
      if (op.action === WriteOpAction.Create) {
        const existing = await this.storage.hasRecord(op.collection, op.rkey)
        if (existing) {
          throw new RecordAlreadyExistsError(op.collection, op.rkey)
        }
        const cid = await cidForLex(op.record)
        newSetHash.add(
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
        newSetHash.remove(
          await formatRecordElement(op.collection, op.rkey, existing),
        )
        const cid = await cidForLex(op.record)
        newSetHash.add(
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
        newSetHash.remove(
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
    this.setHash = new LtHash(commit.setHash)
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
      commit.hash.equals(this.setHash.digest()) &&
      verifyCommit(space, commit)
    )
  }
}

export { RecordAlreadyExistsError, RecordNotFoundError } from './error.js'

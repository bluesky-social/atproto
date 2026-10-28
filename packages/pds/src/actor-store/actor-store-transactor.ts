import type { Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex'
import type { BlobStore } from '@atproto/repo'
import type { ActorStoreResources } from './actor-store-resources.js'
import type { ActorDb } from './db/index.js'
import { PreferenceTransactor } from './preference/transactor.js'
import { RecordTransactor } from './record/transactor.js'
import { RepoTransactor } from './repo/transactor.js'

export class ActorStoreTransactor implements AsyncDisposable {
  private readonly blobstore: BlobStore
  public readonly record: RecordTransactor
  public readonly repo: RepoTransactor
  public readonly pref: PreferenceTransactor

  constructor(
    public readonly did: DidString,
    protected readonly db: ActorDb,
    protected readonly keypair: Keypair,
    protected readonly resources: ActorStoreResources,
  ) {
    this.blobstore = resources.blobstore(did)
    this.record = new RecordTransactor(db, did, this.blobstore)
    this.pref = new PreferenceTransactor(db)
    this.repo = new RepoTransactor(
      db,
      this.blobstore,
      did,
      keypair,
      resources.backgroundQueue,
    )
  }

  async [Symbol.asyncDispose]() {
    await this.blobstore[Symbol.asyncDispose]()
  }
}

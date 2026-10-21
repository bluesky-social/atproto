import type { Keypair } from '@atproto/crypto'
import type { DidString } from '@atproto/lex'
import type { BlobStore } from '@atproto/repo'
import type { ActorStoreResources } from './actor-store-resources.js'
import { ActorStoreTransactor } from './actor-store-transactor.js'
import type { ActorDb } from './db/index.js'
import { PreferenceReader } from './preference/reader.js'
import { RecordReader } from './record/reader.js'
import { RepoReader } from './repo/reader.js'

export class ActorStoreReader implements AsyncDisposable {
  private readonly blobstore: BlobStore
  public readonly repo: RepoReader
  public readonly record: RecordReader
  public readonly pref: PreferenceReader

  constructor(
    public readonly did: DidString,
    protected readonly db: ActorDb,
    protected readonly resources: ActorStoreResources,
    public readonly keypair: () => Promise<Keypair>,
  ) {
    this.blobstore = resources.blobstore(did)
    this.repo = new RepoReader(db, this.blobstore, did)
    this.record = new RecordReader(db, did)
    this.pref = new PreferenceReader(db)

    // Invoke "keypair" once. Also avoids leaking "this" as keypair context.
    let keypairPromise: Promise<Keypair>
    this.keypair = () => (keypairPromise ??= Promise.resolve().then(keypair))
  }

  async [Symbol.asyncDispose]() {
    await this.blobstore[Symbol.asyncDispose]()
  }

  async transact<T>(
    fn: (fn: ActorStoreTransactor) => T | PromiseLike<T>,
  ): Promise<T> {
    const keypair = await this.keypair()
    return this.db.transaction(async (dbTxn) => {
      await using store = new ActorStoreTransactor(
        this.did,
        dbTxn,
        keypair,
        this.resources,
      )
      return await fn(store)
    })
  }
}

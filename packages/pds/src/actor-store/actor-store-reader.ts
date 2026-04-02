import { Keypair } from '@atproto/crypto'
import { ActorStoreResources } from './actor-store-resources'
import { ActorStoreTransactor } from './actor-store-transactor'
import { ActorDb } from './db'
import { PreferenceReader } from './preference/reader'
import { RecordReader } from './record/reader'
import { RepoReader } from './repo/reader'
import { SpaceReader } from './space/reader'

export class ActorStoreReader {
  public readonly repo: RepoReader
  public readonly record: RecordReader
  public readonly pref: PreferenceReader
  public readonly space: SpaceReader

  constructor(
    public readonly did: string,
    protected readonly db: ActorDb,
    protected readonly resources: ActorStoreResources,
    public readonly keypair: () => Promise<Keypair>,
  ) {
    const blobstore = resources.blobstore(did)

    this.repo = new RepoReader(db, blobstore)
    this.record = new RecordReader(db)
    this.pref = new PreferenceReader(db)
    this.space = new SpaceReader(db)

    // Invoke "keypair" once. Also avoids leaking "this" as keypair context.
    let keypairPromise: Promise<Keypair>
    this.keypair = () => (keypairPromise ??= Promise.resolve().then(keypair))
  }

  async transact<T>(
    fn: (fn: ActorStoreTransactor) => T | PromiseLike<T>,
  ): Promise<T> {
    const keypair = await this.keypair()
    return this.db.transaction((dbTxn) => {
      const store = new ActorStoreTransactor(
        this.did,
        dbTxn,
        keypair,
        this.resources,
      )
      return fn(store)
    })
  }
}

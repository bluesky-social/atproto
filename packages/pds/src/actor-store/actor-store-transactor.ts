import type { Keypair } from '@atproto/crypto'
import type { ActorStoreResources } from './actor-store-resources.js'
import type { ActorDb } from './db/index.js'
import { PreferenceTransactor } from './preference/transactor.js'
import { RecordTransactor } from './record/transactor.js'
import { RepoTransactor } from './repo/transactor.js'

export class ActorStoreTransactor {
  public readonly record: RecordTransactor
  public readonly repo: RepoTransactor
  public readonly pref: PreferenceTransactor

  constructor(
    public readonly did: string,
    protected readonly db: ActorDb,
    protected readonly keypair: Keypair,
    protected readonly resources: ActorStoreResources,
  ) {
    const blobstore = resources.blobstore(did)

    this.record = new RecordTransactor(db, blobstore)
    this.pref = new PreferenceTransactor(db)
    this.repo = new RepoTransactor(
      db,
      blobstore,
      did,
      keypair,
      resources.backgroundQueue,
    )
  }
}

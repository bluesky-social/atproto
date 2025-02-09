import { ActorStoreTransactor } from './actor-store-transactor'

export class ActorStoreWriter extends ActorStoreTransactor {
  async transact<T>(
    fn: (fn: ActorStoreTransactor) => T | PromiseLike<T>,
  ): Promise<T> {
    return this.db.transaction((dbTxn) => {
      const transactor = new ActorStoreTransactor(
        this.did,
        dbTxn,
        this.keypair,
        this.resources,
      )
      return fn(transactor)
    })
  }
}

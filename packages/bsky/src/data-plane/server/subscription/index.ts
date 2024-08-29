import { Firehose, SyncQueue } from '@atproto/sync'
import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { subLogger as log } from '../../../logger'
import { IndexingService } from '../indexing'
import { Database } from '../db'
import { BackgroundQueue } from '../background'

export class RepoSubscription {
  firehose: Firehose
  syncQueue: SyncQueue
  background: BackgroundQueue
  indexingSvc: IndexingService

  constructor(
    public opts: { service: string; db: Database; idResolver: IdResolver },
  ) {
    const { service, db, idResolver } = opts
    this.background = new BackgroundQueue(db)
    this.indexingSvc = new IndexingService(db, idResolver, this.background)

    this.syncQueue = new SyncQueue()
    this.firehose = new Firehose({
      idResolver,
      syncQueue: this.syncQueue,
      service,
      unauthenticatedHandles: true, // indexing service handles these
      onError: (err) => log.error({ err }, 'error in subscription'),
      handleEvt: async (evt) => {
        if (evt.event === 'identity') {
          await this.indexingSvc.indexHandle(evt.did, evt.time, true)
        } else if (evt.event === 'account') {
          if (evt.active === false && evt.status === 'deleted') {
            await this.indexingSvc.deleteActor(evt.did)
          } else {
            await this.indexingSvc.updateActorStatus(
              evt.did,
              evt.active,
              evt.status,
            )
          }
        } else {
          const indexFn =
            evt.event === 'delete'
              ? this.indexingSvc.deleteRecord(evt.uri)
              : this.indexingSvc.indexRecord(
                  evt.uri,
                  evt.cid,
                  evt.record,
                  evt.event === 'create'
                    ? WriteOpAction.Create
                    : WriteOpAction.Update,
                  evt.time,
                )
          await Promise.all([
            indexFn,
            this.indexingSvc.setCommitLastSeen(evt.did, evt.commit, evt.rev),
            this.indexingSvc.indexHandle(evt.did, evt.time),
          ])
        }
      },
    })
  }

  start() {
    this.firehose.start()
  }

  async processAll() {
    await this.syncQueue.processAll()
    await this.background.processAll()
  }

  async destroy() {
    await this.firehose.destroy()
    await this.syncQueue.destroy()
    await this.background.processAll()
  }
}

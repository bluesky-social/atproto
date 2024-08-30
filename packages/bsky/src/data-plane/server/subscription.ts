import { Firehose, SyncQueue } from '@atproto/sync'
import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { subLogger as log } from '../../logger'
import { IndexingService } from './indexing'
import { Database } from './db'
import { BackgroundQueue } from './background'

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

    const { syncQueue, firehose } = createFirehose({
      idResolver,
      service,
      indexingSvc: this.indexingSvc,
    })
    this.syncQueue = syncQueue
    this.firehose = firehose
  }

  start() {
    this.firehose.start()
  }

  async restart() {
    await this.destroy()
    const { syncQueue, firehose } = createFirehose({
      idResolver: this.opts.idResolver,
      service: this.opts.service,
      indexingSvc: this.indexingSvc,
    })
    this.syncQueue = syncQueue
    this.firehose = firehose
    this.start()
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

const createFirehose = (opts: {
  idResolver: IdResolver
  service: string
  indexingSvc: IndexingService
}) => {
  const { idResolver, service, indexingSvc } = opts
  const syncQueue = new SyncQueue()
  const firehose = new Firehose({
    idResolver,
    syncQueue,
    service,
    unauthenticatedHandles: true, // indexing service handles these
    onError: (err) => log.error({ err }, 'error in subscription'),
    handleEvt: async (evt) => {
      if (evt.event === 'identity') {
        await indexingSvc.indexHandle(evt.did, evt.time, true)
      } else if (evt.event === 'account') {
        if (evt.active === false && evt.status === 'deleted') {
          await indexingSvc.deleteActor(evt.did)
        } else {
          await indexingSvc.updateActorStatus(evt.did, evt.active, evt.status)
        }
      } else {
        const indexFn =
          evt.event === 'delete'
            ? indexingSvc.deleteRecord(evt.uri)
            : indexingSvc.indexRecord(
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
          indexingSvc.setCommitLastSeen(evt.did, evt.commit, evt.rev),
          indexingSvc.indexHandle(evt.did, evt.time),
        ])
      }
    },
  })
  return { firehose, syncQueue }
}

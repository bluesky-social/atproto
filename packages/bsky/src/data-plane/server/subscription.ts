import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { Event as FirehoseEvent, Firehose, MemoryRunner } from '@atproto/sync'
import { subLogger as log } from '../../logger'
import { BackgroundQueue } from './background'
import { Database } from './db'
import { IndexingService } from './indexing'

export class RepoSubscription {
  firehose: Firehose
  runner: MemoryRunner
  background: BackgroundQueue
  indexingSvc: IndexingService

  constructor(
    public opts: { service: string; db: Database; idResolver: IdResolver },
  ) {
    const { service, db, idResolver } = opts
    this.background = new BackgroundQueue(db)
    this.indexingSvc = new IndexingService(db, idResolver, this.background)

    const { runner, firehose } = createFirehose({
      idResolver,
      service,
      indexingSvc: this.indexingSvc,
    })
    this.runner = runner
    this.firehose = firehose
  }

  start() {
    this.firehose.start()
  }

  async restart() {
    await this.destroy()
    const { runner, firehose } = createFirehose({
      idResolver: this.opts.idResolver,
      service: this.opts.service,
      indexingSvc: this.indexingSvc,
    })
    this.runner = runner
    this.firehose = firehose
    this.start()
  }

  async processAll() {
    await this.runner.processAll()
    await this.background.processAll()
  }

  async destroy() {
    await this.firehose.destroy()
    await this.runner.destroy()
    await this.background.processAll()
  }
}

const createFirehose = (opts: {
  idResolver: IdResolver
  service: string
  indexingSvc: IndexingService
}) => {
  const { idResolver, service, indexingSvc } = opts
  const runner = new MemoryRunner({ startCursor: 0 })
  const firehose = new Firehose({
    idResolver,
    runner,
    service,
    unauthenticatedHandles: true, // indexing service handles these
    unauthenticatedCommits: true, // @TODO there seems to be a very rare issue where the authenticator thinks a block is missing in deletion ops
    onError: (err) => log.error({ err }, 'error in subscription'),
    handleEvent: async (evt: FirehoseEvent) => {
      if (evt.event === 'identity') {
        await indexingSvc.indexHandle(evt.did, evt.time, true)
      } else if (evt.event === 'account') {
        if (evt.active === false && evt.status === 'deleted') {
          await indexingSvc.deleteActor(evt.did)
        } else {
          await indexingSvc.updateActorStatus(evt.did, evt.active, evt.status)
        }
      } else if (evt.event === 'sync') {
        await Promise.all([
          indexingSvc.setCommitLastSeen(evt.did, evt.cid, evt.rev),
          indexingSvc.indexHandle(evt.did, evt.time),
        ])
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
  return { firehose, runner }
}

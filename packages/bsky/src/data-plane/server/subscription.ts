import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { Event as FirehoseEvent, Firehose, MemoryRunner } from '@atproto/sync'
import { subLogger as log } from '../../logger.js'
import { BackgroundQueue } from './background.js'
import { Database } from './db/index.js'
import { IndexingService } from './indexing/index.js'

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

  async start() {
    await this.firehose.start()
  }

  async stop() {
    try {
      await this.firehose.destroy()
    } finally {
      await this.runner.destroy()
    }
  }

  async restart() {
    await this.stop()
    const { runner, firehose } = createFirehose({
      idResolver: this.opts.idResolver,
      service: this.opts.service,
      indexingSvc: this.indexingSvc,
    })
    this.runner = runner
    this.firehose = firehose
    void this.start()
  }

  async processAll() {
    await this.runner.processAll()
    await this.background.processAll()
  }

  async destroy() {
    try {
      await this.stop()
    } finally {
      await this.background.processAll()
    }
  }

  async [Symbol.asyncDispose]() {
    await this.destroy()
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

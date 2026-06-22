import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { Event as FirehoseEvent, Firehose, MemoryRunner } from '@atproto/sync'
import { subLogger as log } from '../../logger.js'
import { BackgroundQueue } from './background.js'
import { Database } from './db/index.js'
import { IndexingService } from './indexing/index.js'

type RepoSubscriptionState = 'stopped' | 'running' | 'destroyed'

export class RepoSubscription {
  state: RepoSubscriptionState = 'stopped'
  firehose: Firehose
  runner: MemoryRunner
  background: BackgroundQueue<Database>
  indexingSvc: IndexingService

  constructor(
    public opts: { service: string; db: Database; idResolver: IdResolver },
  ) {
    const { service, db, idResolver } = opts
    this.background = new BackgroundQueue(db, {
      // @TODO This has historically been using the default concurrency
      // (Infinity) but we may want to limit this in the future to avoid
      // overloading the database with indexing tasks.
      concurrency: Number.POSITIVE_INFINITY,
    })
    this.indexingSvc = new IndexingService(db, idResolver, this.background)

    const { runner, firehose } = createFirehose({
      idResolver,
      service,
      indexingSvc: this.indexingSvc,
    })
    this.runner = runner
    this.firehose = firehose
  }

  get running() {
    return this.state === 'running'
  }

  async start() {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start subscription in state ${this.state}`)
    }
    this.state = 'running'
    await this.firehose.start()
  }

  async stop() {
    if (this.state !== 'running') return
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
    const shouldStop = this.state === 'running'
    this.state = 'destroyed'
    try {
      if (shouldStop) await this.stop()
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

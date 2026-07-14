import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { Event as FirehoseEvent, Firehose, MemoryRunner } from '@atproto/sync'
import { subLogger as log } from '../../logger.js'
import { BackgroundQueue } from './background.js'
import { Database } from './db/index.js'
import { IndexingService } from './indexing/index.js'

export class RepoSubscription {
  private readonly abortController = new AbortController()
  private current?: ReturnType<typeof createFirehose>
  readonly background: BackgroundQueue<Database>
  readonly indexingSvc: IndexingService
  private readonly service: string
  private readonly idResolver: IdResolver

  constructor({
    service,
    db,
    idResolver,
  }: {
    service: string
    db: Database
    idResolver: IdResolver
  }) {
    this.service = service
    this.idResolver = idResolver
    this.background = new BackgroundQueue(db, {
      // @TODO This has historically been using the default concurrency
      // (Infinity) but we may want to limit this in the future to avoid
      // overloading the database with indexing tasks.
      concurrency: Number.POSITIVE_INFINITY,
    })
    this.indexingSvc = new IndexingService(db, idResolver, this.background)
  }

  get destroyed() {
    return this.abortController.signal.aborted
  }

  get running() {
    return this.current != null
  }

  getCursor() {
    return this.current?.runner.getCursor()
  }

  async start() {
    this.abortController.signal.throwIfAborted()

    if (!this.current) {
      this.current = createFirehose({
        idResolver: this.idResolver,
        service: this.service,
        indexingSvc: this.indexingSvc,
      })
      void this.current.firehose.start()
    }
  }

  async stop() {
    try {
      if (this.current) {
        const { firehose, runner } = this.current
        this.current = undefined
        try {
          await firehose.destroy()
        } finally {
          await runner.destroy()
        }
      }
    } finally {
      await this.background.processAll()
    }
  }

  async restart() {
    await this.stop()
    void this.start()
  }

  async processAll() {
    await this.current?.runner.processAll()
    await this.background.processAll()
  }

  async destroy() {
    this.abortController.abort()
    try {
      await this.stop()
    } finally {
      await this.background.destroy()
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

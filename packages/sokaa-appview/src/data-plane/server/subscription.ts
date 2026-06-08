import { IdResolver } from '@atproto/identity'
import { WriteOpAction } from '@atproto/repo'
import { Event as FirehoseEvent, Firehose, MemoryRunner } from '@atproto/sync'
import { getSubscriptionCursor, setSubscriptionCursor } from './cursor'
import { Database } from './db'
import { IndexingService } from './indexing'

export class RepoSubscription {
  firehose: Firehose
  runner: MemoryRunner
  indexingSvc: IndexingService

  private constructor(
    public opts: { service: string; db: Database; idResolver: IdResolver },
    instances: {
      runner: MemoryRunner
      firehose: Firehose
      indexingSvc: IndexingService
    },
  ) {
    this.indexingSvc = instances.indexingSvc
    this.runner = instances.runner
    this.firehose = instances.firehose
  }

  static async create(opts: {
    service: string
    db: Database
    idResolver: IdResolver
  }) {
    const indexingSvc = new IndexingService(opts.db, opts.idResolver)
    const { runner, firehose } = await createFirehose({
      ...opts,
      indexingSvc,
    })
    return new RepoSubscription(opts, { runner, firehose, indexingSvc })
  }

  start() {
    this.firehose.start()
  }

  async restart() {
    await this.destroy()
    const { runner, firehose } = await createFirehose({
      db: this.opts.db,
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
  }

  async destroy() {
    await this.firehose.destroy()
    await this.runner.destroy()
  }
}

const createFirehose = async (opts: {
  db: Database
  idResolver: IdResolver
  service: string
  indexingSvc: IndexingService
}) => {
  const { db, idResolver, service, indexingSvc } = opts
  const startCursor = (await getSubscriptionCursor(db.db)) ?? 0
  const runner = new MemoryRunner({
    startCursor,
    setCursor: async (cursor) => {
      await setSubscriptionCursor(db.db, cursor, new Date().toISOString())
    },
  })
  const firehose = new Firehose({
    idResolver,
    runner,
    service,
    unauthenticatedHandles: true,
    unauthenticatedCommits: true,
    onError: (err) => console.error('firehose subscription error', err),
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
        await indexingSvc.indexHandle(evt.did, evt.time)
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
        await Promise.all([indexFn, indexingSvc.indexHandle(evt.did, evt.time)])
      }
    },
  })
  return { firehose, runner }
}

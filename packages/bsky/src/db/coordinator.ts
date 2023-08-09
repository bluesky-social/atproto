import { Migrator } from 'kysely'
import { NotEmptyArray } from '@atproto/common'
import PrimaryDatabase from './primary'
import Database from './db'

type CoordinatorOptions = {
  schema?: string
  primary: {
    url: string
    poolSize?: number
    poolMaxUses?: number
    poolIdleTimeoutMs?: number
  }
  replicas: {
    urls: NotEmptyArray<string>
    poolSize?: number
    poolMaxUses?: number
    poolIdleTimeoutMs?: number
  }
}

export class DatabaseCoordinator {
  migrator: Migrator
  destroyed = false

  private primary: PrimaryDatabase
  private replicas: Database[]
  private roundRobinPosition: number

  constructor(public opts: CoordinatorOptions) {
    this.primary = new PrimaryDatabase({
      url: opts.primary.url,
      schema: opts.schema,
      poolSize: opts.primary.poolSize,
      poolMaxUses: opts.primary.poolMaxUses,
      poolIdleTimeoutMs: opts.primary.poolIdleTimeoutMs,
    })
    this.replicas = opts.replicas.urls.map(
      (url) =>
        new Database({
          url,
          schema: opts.schema,
          poolSize: opts.replicas.poolSize,
          poolMaxUses: opts.replicas.poolMaxUses,
          poolIdleTimeoutMs: opts.replicas.poolIdleTimeoutMs,
        }),
    )
  }

  getPrimary(): PrimaryDatabase {
    return this.primary
  }

  getReplica(): Database {
    this.roundRobinPosition =
      (this.roundRobinPosition + 1) % this.replicas.length
    return this.replicas[this.roundRobinPosition]
  }

  async close(): Promise<void> {
    await Promise.all([
      this.primary.close(),
      ...this.replicas.map((db) => db.close),
    ])
  }
}

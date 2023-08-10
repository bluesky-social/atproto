import { Migrator } from 'kysely'
import PrimaryDatabase from './primary'
import Database from './db'
import { PgOptions } from './types'

type ReplicaTag = 'timeline'
type ReplicaOptions = PgOptions & { tag?: ReplicaTag }

type CoordinatorOptions = {
  schema?: string
  primary: PgOptions
  replicas: ReplicaOptions[]
}

type ReplicaGroup = {
  dbs: Database[]
  roundRobinIdx: number
}

export class DatabaseCoordinator {
  migrator: Migrator
  destroyed = false

  private primary: PrimaryDatabase
  private allReplicas: Database[]
  private tagged: Record<string, ReplicaGroup>
  private untagged: ReplicaGroup

  constructor(public opts: CoordinatorOptions) {
    this.primary = new PrimaryDatabase({
      schema: opts.schema,
      ...opts.primary,
    })
    this.allReplicas = []
    this.tagged = {}
    this.untagged = {
      dbs: [],
      roundRobinIdx: 0,
    }
    for (const cfg of opts.replicas) {
      const db = new Database({
        schema: opts.schema,
        ...cfg,
      })
      this.allReplicas.push(db)
      if (cfg.tag) {
        this.tagged[cfg.tag] ??= {
          dbs: [],
          roundRobinIdx: 0,
        }
        this.tagged[cfg.tag].dbs.push(db)
      } else {
        this.untagged.dbs.push(db)
      }
    }
  }

  getPrimary(): PrimaryDatabase {
    return this.primary
  }

  getReplica(tag?: string): Database {
    if (tag && this.tagged[tag]) {
      this.tagged[tag].roundRobinIdx =
        (this.tagged[tag].roundRobinIdx + 1) % this.tagged[tag].dbs.length
      return this.tagged[tag].dbs[this.tagged[tag].roundRobinIdx]
    } else {
      this.untagged.roundRobinIdx =
        (this.untagged.roundRobinIdx + 1) % this.untagged.dbs.length
      return this.untagged.dbs[this.untagged.roundRobinIdx]
    }
  }

  async close(): Promise<void> {
    await Promise.all([
      this.primary.close(),
      ...this.allReplicas.map((db) => db.close),
    ])
  }
}

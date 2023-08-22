import { Migrator } from 'kysely'
import PrimaryDatabase from './primary'
import Database from './db'
import { PgOptions } from './types'
import { dbLogger } from '../logger'

type ReplicaTag = 'timeline' | 'feed' | 'search' | 'thread' | '*'
type ReplicaOptions = PgOptions & { tags?: ReplicaTag[] }

type CoordinatorOptions = {
  schema?: string
  primary: PgOptions
  replicas?: ReplicaOptions[]
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
  private tagWarns = new Set<string>()

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
    for (const cfg of opts.replicas ?? []) {
      const db = new Database({
        schema: opts.schema,
        ...cfg,
      })
      this.allReplicas.push(db)
      // setup different groups of replicas based on tag, each round-robins separately.
      if (cfg.tags?.length) {
        for (const tag of cfg.tags) {
          if (tag === '*') {
            this.untagged.dbs.push(db)
          } else {
            this.tagged[tag] ??= {
              dbs: [],
              roundRobinIdx: 0,
            }
            this.tagged[tag].dbs.push(db)
          }
        }
      } else {
        this.untagged.dbs.push(db)
      }
    }
    // guarantee there is always a replica around to service any query, falling back to primary.
    if (!this.untagged.dbs.length) {
      if (this.allReplicas.length) {
        this.untagged.dbs = [...this.allReplicas]
      } else {
        this.untagged.dbs = [this.primary]
      }
    }
  }

  getPrimary(): PrimaryDatabase {
    return this.primary
  }

  getReplicas(): Database[] {
    return this.allReplicas
  }

  getReplica(tag?: ReplicaTag): Database {
    if (tag && this.tagged[tag]) {
      return nextDb(this.tagged[tag])
    }
    if (tag && !this.tagWarns.has(tag)) {
      this.tagWarns.add(tag)
      dbLogger.warn({ tag }, 'no replica for tag, falling back to any replica')
    }
    return nextDb(this.untagged)
  }

  async close(): Promise<void> {
    await Promise.all([
      this.primary.close(),
      ...this.allReplicas.map((db) => db.close()),
    ])
  }
}

// @NOTE mutates group incrementing roundRobinIdx
const nextDb = (group: ReplicaGroup) => {
  const db = group.dbs[group.roundRobinIdx]
  group.roundRobinIdx = (group.roundRobinIdx + 1) % group.dbs.length
  return db
}
